"""
Views for prediction, counterfactual generation, and LLM explanations.
"""
import json
import os
from typing import Dict, Any, List, Optional, Tuple

import dice_ml
import google.generativeai as genai
import numpy as np
import pandas as pd
import shap
from django.conf import settings
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from datasets.models import DatasetColumn
from datasets.utils import load_clean_dataset
from models.models import MLModel
from models.utils import load_model, load_model_pipeline

from .models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch
from .serializers import (
    PredictionSerializer,
    CounterfactualSerializer,
    SHAPExplanationSerializer,
    CounterfactualSearchSerializer,
    PredictRequestSerializer,
    CounterfactualRequestSerializer
)
from .utils import (
    hash_input_data,
    prepare_shap_data,
    get_feature_changes,
    calculate_actionability_score,
    select_top_counterfactuals_by_diversity,
    calculate_combined_score,
    group_counterfactuals_by_features,
    get_feature_combination_key
)


# ============================================================================
#                               Helper Functions
# ============================================================================

def _get_shap_feature_names(preprocessor, ml_model) -> List[str]:
    """
    Extract feature names after preprocessing for SHAP values.
    
    Args:
        preprocessor: Sklearn ColumnTransformer from the pipeline
        ml_model: MLModel instance with train_metrics
        
    Returns:
        List of feature names in the transformed space
    """
    try:
        num_names = ml_model.train_metrics.get('continuous_features', [])
        cat_names = []
        categorical_features = ml_model.train_metrics.get('categorical_features', [])
        
        if categorical_features:
            cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
            cat_names = list(cat_encoder.get_feature_names_out(categorical_features))
        
        return num_names + cat_names
    except Exception:
        # Fallback to generic names
        return []


def _calculate_shap_values(pipeline, input_df: pd.DataFrame, ml_model) -> Optional[Dict[str, Any]]:
    """
    Calculate SHAP values for a given input.
    
    Args:
        pipeline: Trained sklearn pipeline
        input_df: Input data as DataFrame
        ml_model: MLModel instance
        
    Returns:
        Dictionary with SHAP data or None on error
    """
    try:
        preprocessor = pipeline.named_steps['preprocessor']
        classifier = pipeline.named_steps['model']
        
        transformed_input = preprocessor.transform(input_df)
        explainer = shap.TreeExplainer(classifier)
        
        # Get expected value (base value)
        base_value = explainer.expected_value
        if isinstance(base_value, (np.ndarray, list)):
            base_value = float(base_value[-1])  # For multi-class/binary, take positive class
        elif hasattr(base_value, 'item'):
            base_value = base_value.item()
        else:
            base_value = float(base_value)
        
        shap_vals = explainer.shap_values(transformed_input)
        
        # Handle multi-class output
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1][0]  # Positive class, first row
        else:
            shap_vals = shap_vals[0]  # First row
        
        # Get feature names
        feature_names = _get_shap_feature_names(preprocessor, ml_model)
        if not feature_names:
            feature_names = [f"feature_{i}" for i in range(len(shap_vals))]
        
        return prepare_shap_data(shap_vals, feature_names, base_value)
    
    except Exception:
        return None


def _parse_desired_class(desired_class: Any) -> Any:
    """
    Parse and convert desired class to appropriate type for DiCE.
    
    Args:
        desired_class: Raw desired class value (may be string or number)
        
    Returns:
        Converted desired class value
    """
    if isinstance(desired_class, str):
        if desired_class.isdigit():
            return int(desired_class)
        try:
            return float(desired_class)
        except ValueError:
            return desired_class
    return desired_class


def _process_counterfactual(
    cf_dict: Dict,
    cf_target: Any,
    original_input: Dict,
    model_wrapper
) -> Dict[str, Any]:
    """
    Process a single counterfactual and calculate its metadata.
    
    Args:
        cf_dict: Counterfactual feature values
        cf_target: Target class for this counterfactual
        original_input: Original input features
        model_wrapper: PipelineWrapper instance forfpredictions
        
    Returns:
        Dictionary with counterfactual metadata
    """
    changes = get_feature_changes(original_input, cf_dict)
    num_changes = len(changes)
    changed_features = list(changes.keys())
    
    # Calculate confidence
    cf_input_df = pd.DataFrame([cf_dict])
    cf_prediction_probs = model_wrapper.predict_proba(cf_input_df)[0]
    
    try:
        target_idx = model_wrapper.classes_.tolist().index(cf_target)
        cf_prob_val = float(cf_prediction_probs[target_idx])
    except Exception:
        cf_prob_val = float(max(cf_prediction_probs))
    
    return {
        'counterfactual_data': cf_dict,
        'counterfactual_class': str(cf_target),
        'counterfactual_prediction': float(cf_target) if isinstance(cf_target, (int, float, np.number)) else 0.0,
        'confidence': cf_prob_val,
        'feature_changes': changes,
        'num_changes': num_changes,
        'changed_features': changed_features,
    }


def _build_llm_prompt_context(
    prediction: Prediction,
    predicted_label: str,
    feature_descriptions: Dict[str, str]
) -> Tuple[str, str]:
    """
    Build the context section of the LLM prompt.
    
    Args:
        prediction: Prediction instance
        predicted_label: Predicted outcome label
        feature_descriptions: Dictionary mapping features to descriptions
        
    Returns:
        Tuple of (input_data_str, confidence_str)
    """
    # Build confidence string
    confidence_str = ""
    if prediction.prediction_probabilities:
        conf_val = prediction.prediction_probabilities.get(str(prediction.prediction_class))
        if conf_val:
            confidence_str = f" with a confidence level of {float(conf_val)*100:.1f}%"
    
    # Build feature context
    input_items = []
    for k, v in prediction.input_data.items():
        desc = feature_descriptions.get(k)
        if desc:
            input_items.append(f"{k} (meaning {desc}): {v}")
        else:
            input_items.append(f"{k}: {v}")
    
    input_data_str = ", ".join(input_items)
    
    return input_data_str, confidence_str


def _format_counterfactuals_for_llm(
    counterfactual_groups: List[Dict],
    feature_descriptions: Dict[str, str]
) -> str:
    """
    Format grouped counterfactual combinations for LLM prompt.
    Handles both a list of group objects or a dictionary of groups.
    """
    lines = ["AVAILABLE COUNTERFACTUAL GROUPS:\n"]
    
    # Convert dict to list if necessary (handles raw grouped_counterfactuals from frontend)
    if isinstance(counterfactual_groups, dict):
        groups_to_process = []
        for key, options in counterfactual_groups.items():
            groups_to_process.append({'groupName': key, 'options': options})
    else:
        groups_to_process = counterfactual_groups
    
    for idx, group in enumerate(groups_to_process):
        group_name = group.get('groupName') or group.get('feature_combo') or f"Group {idx+1}"
        lines.append(f"Group {idx + 1} ({group_name}):")
        
        options = group.get('options') or []
        for option in options:
            opt_id = option.get('rank') or option.get('id')
            confidence = option.get('confidence')
            conf_str = f" [Confidence: {confidence*100:.1f}%]" if confidence is not None else ""
            
            change_parts = []
            for feature in option.get('features', []):
                name = feature.get('name')
                value = feature.get('value')
                desc = feature_descriptions.get(name, "")
                desc_str = f" ({desc})" if desc else ""
                change_parts.append(f"{name}{desc_str}: {value}")
            
            changes_str = ", ".join(change_parts)
            lines.append(f"  - Option ID {opt_id}:{conf_str} {changes_str}")
        lines.append("")
        
    return "\n".join(lines)


# ============================================================================
#                           Pipeline Wrapper for DiCE
# ============================================================================

class PipelineWrapper:
    """
    Wraps a fitted sklearn Pipeline so that DiCE can generate counterfactuals
    in the **original (human-readable) feature space**.

    DiCE calls predict_proba / predict on raw DataFrames (e.g., with string
    categorical values). This wrapper handles encoding/scaling internally
    by delegating to the pipeline's preprocessor step before calling the model.
    """

    def __init__(self, pipeline):
        self.pipeline = pipeline
        self.preprocessor = pipeline.named_steps['preprocessor']
        self.model = pipeline.named_steps['model']

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_transformed = self.preprocessor.transform(X)
        return self.model.predict_proba(X_transformed)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        X_transformed = self.preprocessor.transform(X)
        return self.model.predict(X_transformed)

    # Expose classes_ so DiCE / confidence scoring can look up class indices
    @property
    def classes_(self):
        return self.model.classes_


# ============================================================================
#                       Counterfactual Selection Logic
# ============================================================================

def _select_best_counterfactual(cfs):
    """
    Deterministically select the best counterfactual from a queryset.

    Rules (in priority order):
      1. Filter out low-confidence options (< 70%) unless all options are low confidence
      2. Fewest feature changes (simplest = most achievable)
      3. Among options with equal changes: highest confidence
      4. A multi-change option may override the fewest-change winner ONLY IF:
         - It has <= 1 extra feature compared to the fewest-change option
         - Its total score (confidence + actionability) is significantly better
    """
    cf_list = list(cfs[:10])
    if not cf_list:
        return None

    def conf(cf):
        return float(cf.counterfactual_data.get('_confidence', 0.5))

    def cf_score(cf):
        # We consider both confidence and actionability for internal ranking 
        return float(cf.counterfactual_data.get('_confidence', 0.5)) + float(cf.actionability_score)

    # Step 1: Filter by confidence threshold
    MIN_CONFIDENCE = 0.70  # Only recommend options with >= 70% confidence
    high_conf_options = [cf for cf in cf_list if conf(cf) >= MIN_CONFIDENCE]
    
    # If we have high-confidence options, use only those; otherwise fall back to all
    candidates = high_conf_options if high_conf_options else cf_list

    # Step 2: Find the fewest-change option among candidates
    min_changes = min(cf.num_changes for cf in candidates)
    fewest_change_candidates = [cf for cf in candidates if cf.num_changes == min_changes]
    best_simple = max(fewest_change_candidates, key=cf_score)

    # Step 3: See if any other option with at most 1 extra change has a significantly better score
    for cf in candidates:
        if cf == best_simple:
            continue
        extra_changes = cf.num_changes - min_changes
        # We use a combined confidence + actionability "gain" to justify an extra change
        score_gain = cf_score(cf) - cf_score(best_simple)
        if extra_changes <= 1 and score_gain > 0.05:
            best_simple = cf  # override

    return best_simple


# ============================================================================
#                           ViewSets - API Endpoints
# ============================================================================

class PredictionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Prediction operations
    """
    queryset = Prediction.objects.all()
    serializer_class = PredictionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Prediction.objects.filter(
            Q(created_by=self.request.user) | Q(model__created_by=self.request.user)
        ).distinct().order_by('-created_at')
    
    @action(detail=False, methods=['post'])
    def predict(self, request):
        """
        Make a prediction with optional SHAP explanation.
        
        Expects:
            - model_id: ID of the trained ML model
            - input_data: Dictionary of feature values
            - generate_shap: Boolean to generate SHAP values (default: True)
        """
        serializer = PredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            # Fetch and validate model
            ml_model = MLModel.objects.get(id=data['model_id'], created_by=request.user)
            if not ml_model.is_trained or not ml_model.model_file:
                return Response(
                    {'error': 'Model is not trained yet'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Load pipeline and prepare input
            pipeline = load_model_pipeline(ml_model)
            input_dict = data['input_data']
            df_input = pd.DataFrame([input_dict])
            
            # Make prediction
            prediction_val = pipeline.predict(df_input)[0]
            prediction_probs = None
            
            if hasattr(pipeline, 'predict_proba'):
                probs = pipeline.predict_proba(df_input)[0]
                prediction_probs = {str(i): float(p) for i, p in enumerate(probs)}
            
            # Save prediction record
            prediction_record = Prediction.objects.create(
                model=ml_model,
                input_data=input_dict,
                input_hash=hash_input_data(input_dict),
                prediction_value=float(prediction_val),
                prediction_class=str(prediction_val),
                prediction_probabilities=prediction_probs,
                created_by=request.user
            )
            
            # Generate SHAP explanation if requested
            shap_result = None
            if data.get('generate_shap', True):
                shap_data = _calculate_shap_values(pipeline, df_input, ml_model)
                
                if shap_data:
                    SHAPExplanation.objects.create(
                        prediction=prediction_record,
                        shap_values=shap_data['shap_values'],
                        base_value=shap_data['base_value'],
                        feature_importance=shap_data['feature_importance']
                    )
                    shap_result = shap_data
            
            return Response({
                'status': 'success',
                'prediction_id': prediction_record.id,
                'prediction_value': float(prediction_val),
                'prediction_class': str(prediction_val),
                'prediction_probabilities': prediction_probs,
                'shap_explanation': shap_result
            }, status=status.HTTP_200_OK)
            
        except MLModel.DoesNotExist:
            return Response(
                {'error': 'Model not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({
                'status': 'prediction failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def shap(self, request, pk=None):
        """
        Get SHAP explanation for a prediction
        """
        prediction = self.get_object()
        # TODO: Get or generate SHAP explanation
        return Response({'status': 'SHAP endpoint - not implemented yet'})
    
    @action(detail=True, methods=['post'])
    def find_counterfactuals(self, request, pk=None):
        """
        Find diverse counterfactual explanations.
        
        Generates 50-100 counterfactuals dynamically, groups by feature combinations,
        and returns all grouped results for LLM selection.
        """
        prediction = self.get_object()
        serializer = CounterfactualRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            ml_model = prediction.model
            dataset = ml_model.dataset
            
            # Load data and model
            df = load_clean_dataset(dataset.file.path)
            pipeline = load_model_pipeline(ml_model)
            
            # Setup DiCE 
            continuous_features = ml_model.train_metrics.get('continuous_features', [])
            target_name = ml_model.target_name
            model_wrapper = PipelineWrapper(pipeline)

            try:
                target_col_record = DatasetColumn.objects.get(
                    dataset=dataset,
                    name=target_name
                )
                dropdown_values = target_col_record.get_dropdown_values()

                if dropdown_values:
                    label_mapping = {val: idx for idx, val in enumerate(dropdown_values)}
                    df[target_name] = df[target_name].map(label_mapping)

                    # Catch unmapped values (values in data but missing from dropdown_values)
                    if df[target_name].isna().any():
                        raise ValueError(
                            f"found in dropdown list: {dropdown_values}"
                        )

            except DatasetColumn.DoesNotExist:
                pass  

            d = dice_ml.Data(
                dataframe=df,
                continuous_features=continuous_features,
                outcome_name=target_name
            )
            m = dice_ml.Model(
                model=model_wrapper,
                backend='sklearn',
                model_type='classifier'
            )
            exp = dice_ml.Dice(d, m, method='random')
            
            # Handle feature constraints
            constraints = data.get('feature_constraints', {})
            features_to_vary = "all"
            
            if isinstance(constraints, dict) and constraints.get('frozen_features'):
                frozen = constraints['frozen_features']
                features_to_vary = [f for f in ml_model.feature_names if f not in frozen]
            
            desired_class = _parse_desired_class(data.get('desired_class', "opposite"))

            # Map string desired_class to int using label_mapping (e.g. 'Yes' -> 1, 'No' -> 0)
            if label_mapping and isinstance(desired_class, str) and desired_class in label_mapping:
                desired_class = label_mapping[desired_class]
            
            # Generate counterfactuals dynamically
            original_input = prediction.input_data
            input_df = pd.DataFrame([original_input])
            # Coerce continuous features to numeric types to avoid dtype errors
            for col in continuous_features:
                if col in input_df.columns:
                    input_df[col] = pd.to_numeric(input_df[col], errors='coerce')
            
            all_cfs = []
            num_cf = 50  # Start with 50
            max_cf = 100
            min_diverse_groups = 5
            
            while num_cf <= max_cf:
                dice_exp = exp.generate_counterfactuals(
                    input_df,
                    total_CFs=num_cf,
                    desired_class=desired_class,
                    features_to_vary=features_to_vary
                )
                
                cf_df = dice_exp.cf_examples_list[0].final_cfs_df
                if cf_df is None or cf_df.empty:
                    return Response(
                        {'status': 'no counterfactuals found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Extract target values and features
                if target_name in cf_df.columns:
                    target_vals = cf_df[target_name].tolist()
                    cf_features_df = cf_df.drop(columns=[target_name])
                else:
                    target_vals = [desired_class] * len(cf_df)
                    cf_features_df = cf_df
                
                # Process all counterfactuals
                all_cfs = []
                for idx, row in cf_features_df.iterrows():
                    cf_dict = row.to_dict()
                    cf_target = target_vals[idx] if idx < len(target_vals) else desired_class
                    
                    cf_data = _process_counterfactual(
                        cf_dict,
                        cf_target,
                        original_input,
                        model_wrapper
                    )
                    
                    # Skip if no changes
                    if cf_data['num_changes'] == 0:
                        continue
                    
                    all_cfs.append(cf_data)
                
                # Check diversity
                feature_combos = set(','.join(sorted(cf['changed_features'])) for cf in all_cfs)
                if len(feature_combos) >= min_diverse_groups or num_cf >= max_cf:
                    break
                
                num_cf = 100
            
            # Calculate combined scores and group
            for cf in all_cfs:
                cf['combined_score'] = calculate_combined_score(
                    cf['feature_changes'],
                    cf['confidence'],
                    original_input
                )
                cf['feature_combo'] = get_feature_combination_key(cf['changed_features'])
            
            grouped = group_counterfactuals_by_features(all_cfs)
            
            # Select the best representative from each unique feature combination
            diverse_cfs = select_top_counterfactuals_by_diversity(all_cfs, original_input, top_n=5)
            prediction.counterfactuals.all().delete()
            
            # Persist these representatives to the database to generate IDs
            saved_cf_map = {} # Map combo_key -> saved DB object
            for rank, cf in enumerate(diverse_cfs, start=1):
                score = calculate_actionability_score(cf['feature_changes'])
                db_cf = Counterfactual.objects.create(
                    prediction=prediction,
                    counterfactual_data=cf['counterfactual_data'],
                    counterfactual_prediction=cf.get('counterfactual_prediction', 0.0),
                    counterfactual_class=cf['counterfactual_class'],
                    distance=cf.get('combined_score', float(cf['num_changes'])),
                    num_changes=cf['num_changes'],
                    changed_features=cf['changed_features'],
                    feature_changes=cf['feature_changes'],
                    confidence=cf['confidence'],
                    is_actionable=(score > 0.5),
                    actionability_score=score,
                    rank=rank
                )
                cf['id'] = db_cf.id
                cf['rank'] = rank
                saved_cf_map[cf['_feature_combo']] = cf

            # Build grouped results using the saved IDs for the representative of each group
            grouped_results = {}
            for combo_key, cf_list in grouped.items():
                sorted_cfs = sorted(cf_list, key=lambda x: x['combined_score'], reverse=True)
                # Ensure the first item (representative) has the DB ID
                if combo_key in saved_cf_map:
                    sorted_cfs[0]['id'] = saved_cf_map[combo_key]['id']
                    sorted_cfs[0]['rank'] = saved_cf_map[combo_key]['rank']
                
                grouped_results[combo_key] = sorted_cfs
            
            return Response({
                'status': 'counterfactuals generated',
                'total_generated': len(all_cfs),
                'unique_feature_combinations': len(grouped),
                'grouped_counterfactuals': grouped_results,
                'top_5': diverse_cfs[:5]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'status': 'generation failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def explain(self, request, pk=None):
        """
        Use LLM to explain prediction and select best 5 diverse counterfactuals.
        
        Feature descriptions are automatically fetched from the dataset.
        
        Accepts:
            - expected_outcome: Desired outcome class
            - grouped_counterfactuals: All counterfactuals grouped by feature combinations
            - feature_descriptions (optional): Override auto-fetched descriptions
        """
        prediction = self.get_object()

        expected_outcome = request.data.get('expected_outcome')
        expected_label = request.data.get('expected_outcome_label', expected_outcome)
        predicted_label = request.data.get('predicted_outcome_label', prediction.prediction_class)
        target_description = request.data.get('target_description')
        counterfactual_combinations = request.data.get('counterfactual_combinations', [])
        
        # Fetch feature and target descriptions from database in one query
        feature_descriptions = request.data.get('feature_descriptions')
        
        if (not feature_descriptions or not target_description) and prediction.model.dataset:
            # Fetch all columns at once to avoid multiple queries
            all_columns = list(DatasetColumn.objects.filter(
                dataset=prediction.model.dataset
            ))
            
            # Extract feature descriptions
            if not feature_descriptions:
                feature_descriptions = {
                    col.name: col.description
                    for col in all_columns
                    if col.is_feature and col.description
                }
            
            # Extract target description (there's always exactly one target column)
            if not target_description:
                for col in all_columns:
                    if col.is_target and col.description:
                        target_description = col.description
                        break
        
        feature_descriptions = feature_descriptions or {}

        try:
            api_key = os.environ.get('GEMINI_API_KEY')

            # Build context using helper
            input_data_str, confidence_str = _build_llm_prompt_context(
                prediction,
                predicted_label,
                feature_descriptions
            )

            # Define outcome labels
            target_text = f"'{expected_label}'"
            if target_description:
                target_text += f" (interpreted as: {target_description})"
            predicted_text = f"'{predicted_label}'"

            # Build base prompt
            prompt = (
                f"You are an expert AI data scientist explaining an XGBoost model prediction to an average user.\n\n"
                f"CONTEXT:\n"
                f"The user provided the following data points:\n{input_data_str}\n\n"
                f"The model initially predicted the outcome to be: {predicted_text}{confidence_str}.\n"
                f"IMPORTANT: You MUST return your response as a valid JSON object matching this exact structure (with no markdown wrapping or code blocks):\n"
                f"{{\n"
                f"  \"summary\": \"Overall summary of the prediction and high-level strategy\",\n"
                f"  \"options\": [\n"
                f"    {{\n"
                f"      \"selected_variant_id\": 1,\n"
                f"      \"explanation\": \"Detailed explanation of this counterfactual option\"\n"
                f"    }}\n"
                f"  ]\n"
                f"}}\n\n"
            )

            # Add counterfactual-based tasks
            if expected_outcome is not None and counterfactual_combinations:
                prompt += f"The user's goal is: {target_text}.\n\n"
                prompt += _format_counterfactuals_for_llm(counterfactual_combinations, feature_descriptions)
                prompt += (
                    f"\nTASK:\n"
                    f"1. ANALYZE all the counterfactual groups above.\n"
                    f"2. Fill the 'summary' field with a brief summary of the overarching strategy to reach {target_text} in one short sentence.\n"
                    f"3. You MUST provide a strategy guide for EVERY SINGLE Option ID listed above. Even if they are similar, do NOT combine them.\n"
                    f"4. The 'options' array MUST contain exactly as many objects as there are Option IDs provided. If 5 IDs are shown, you MUST return 5 objects.\n"
                    f"5. IMPORTANT: Set the 'selected_variant_id' field to match the numeric Option ID exactly.\n"
                    f"6. In each 'explanation' field, you MUST explain EACH feature change in that specific option separately.\n"
                    f"   For EVERY feature changed in the option, format it EXACTLY like this (DO NOT output literal brackets or headers):\n"
                    f"   Increase your weekly work hours from 50 to 55.\n"
                    f"   - Dedicating slightly more time to your professional role can reinforce your current income trajectory.\n\n"
                    f"   If there are multiple feature changes in the option, stack them sequentially using the exact same format.\n"
                    f"   Note: Keep it extremely punchy. Do NOT mention confidence levels, scores, or use long paragraphs.\n"
                    f"7. Replace technical feature names with plain English. You are provided with the exact descriptions for each feature in parentheses next to the feature names - USE THESE DESCRIPTIONS to accurately explain the adjustments.\n"
                    f"8. Use active verbs and get straight to the point.\n"
                )
            
            elif expected_outcome is not None:
                # Fallback path: Ensure LLM still returns structured JSON to update the DB
                prompt += f"The user's goal or expected outcome is: {target_text}.\n\n"

                cfs = prediction.counterfactuals.filter(
                    counterfactual_class=str(expected_outcome)
                ).order_by('-actionability_score')

                if cfs.exists():
                    chosen_cf = _select_best_counterfactual(cfs)
                    if chosen_cf:
                        chosen_conf = float(chosen_cf.counterfactual_data.get('_confidence', 0.5))
                        
                        change_lines = []
                        for k, v in chosen_cf.feature_changes.items():
                            desc = feature_descriptions.get(k)
                            label_hint = f" ({desc})" if desc else ""
                            change_lines.append(f"  - Change {k}{label_hint} from {v['original']} to {v['counterfactual']}")
                        
                        changes_str = "\n".join(change_lines)

                        prompt += (
                            f"Our system has selected the most realistic path to reach {target_text}:\n\n"
                            f"{changes_str}\n\n"
                            f"TASK:\n"
                            f"1. Explain these changes using active verbs and plain English.\n"
                            f"2. Return your response in the EXACT JSON structure defined above.\n"
                            f"3. Use ID {chosen_cf.id} for the 'selected_variant_id'.\n"
                            f"4. Set 'summary' to a brief strategy summary.\n"
                        )
                else:
                    if str(expected_outcome) == str(prediction.prediction_class):
                        prompt += "The prediction matches the user's expectations. Please suggest 2-3 ways the user can further improve their current features.\n"
                    else:
                        prompt += f"Could you provide general advice on what factors usually influence the outcome to become {expected_outcome}?\n"
            else:
                prompt += "Please provide a brief, intuitive explanation of what this outcome means based on the input data.\n"

            # Handle missing API key
            if not api_key:
                mock_explanation = {
                    "summary": "This is a simulated JSON LLM explanation. To get real explanations, ensure the GEMINI_API_KEY environment variable is set. Base prompt was: " + prompt[:100],
                    "options": [{"id": c.get('id', 1), "explanation": "Mock explanation for this option"} for c in counterfactual_combinations]
                }
                return Response({'explanation': mock_explanation}, status=status.HTTP_200_OK)

            # Call Gemini API
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                'models/gemini-3.1-flash-lite-preview',
                system_instruction=(
                    "You are a helpful analyst who translates machine learning data into clear, "
                    "human-friendly advice. You always pick the most empathetic and actionable way "
                    "to describe technical features. You MUST ALWAYS output valid JSON matching the user's structure."
                )
            )
            response = model.generate_content(prompt)
            
            response_text = response.text
            import re
            # Clean up potential markdown code block artifacts
            response_text = re.sub(r'^```(?:json)?\s*', '', response_text.strip())
            response_text = re.sub(r'\s*```$', '', response_text)
            
            try:
                explanation_data = json.loads(response_text)
            except Exception as parse_err:
                # Try to find the JSON object within the text if the model included conversational filler
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    try:
                        explanation_data = json.loads(json_match.group())
                    except:
                        explanation_data = {"summary": response_text, "options": []}
                else:
                    explanation_data = {"summary": response_text, "options": []}
            
            # Persist the summary to the database
            prediction.llm_summary = explanation_data
            prediction.save()
            
            # Map and save individual strategy guides to counterfactual records
            options_list = []
            if isinstance(explanation_data, dict):
                options_list = explanation_data.get('options', [])
            elif isinstance(explanation_data, list):
                options_list = explanation_data

            print(options_list)

            if options_list:
                for option in options_list:
                    # Support both standard key and a common LLM fallback key
                    cf_id = option.get('selected_variant_id') or option.get('id')
                    cf_text = option.get('explanation')
                    
                    if cf_id and cf_text:
                        try:
                            # Try updating by rank for this specific prediction first
                            # (Handles cases where selected_variant_id is the 1-based rank)
                            updated_count = Counterfactual.objects.filter(
                                rank=int(cf_id), 
                                prediction=prediction
                            ).update(explanation=cf_text)
                            
                            # Fallback to primary key 'id' if no match found by rank
                            if updated_count == 0:
                                Counterfactual.objects.filter(
                                    id=int(cf_id), 
                                    prediction=prediction
                                ).update(explanation=cf_text)
                        except (ValueError, TypeError):
                            continue

            return Response({'explanation': explanation_data}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'status': 'explanation failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

# ----------------------------------------------------------------------------
#                           Counterfactual ViewSet
# ----------------------------------------------------------------------------
            
class CounterfactualViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactuals
    """
    queryset = Counterfactual.objects.all()
    serializer_class = CounterfactualSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset().filter(prediction__created_by=self.request.user)
        prediction_id = self.request.query_params.get('prediction_id', None)
        if prediction_id:
            queryset = queryset.filter(prediction_id=prediction_id)
        return queryset

# ----------------------------------------------------------------------------
#                       Counterfactual Search ViewSet
# ----------------------------------------------------------------------------

class CounterfactualSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactual search jobs
    """
    queryset = CounterfactualSearch.objects.all()
    serializer_class = CounterfactualSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CounterfactualSearch.objects.filter(
            prediction__created_by=self.request.user
        ).order_by('-created_at')

