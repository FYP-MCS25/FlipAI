from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
import os
import pandas as pd
import numpy as np
import shap
import dice_ml
import google.generativeai as genai
from django.conf import settings

from models.models import MLModel
from models.utils import load_model, load_model_pipeline
from datasets.utils import load_clean_dataset

from .models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch
from .utils import hash_input_data, prepare_shap_data, get_feature_changes, calculate_actionability_score
from .serializers import (
    PredictionSerializer, 
    CounterfactualSerializer, 
    SHAPExplanationSerializer,
    CounterfactualSearchSerializer,
    PredictRequestSerializer,
    CounterfactualRequestSerializer
)


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


def _select_best_counterfactual(cfs):
    """
    Deterministically select the best counterfactual from a queryset.

    Rules (in priority order):
      1. Fewest feature changes  (simplest = most achievable)
      2. Among options with equal changes: highest confidence
      3. A multi-change option may override the fewest-change winner ONLY IF:
         - It has <= 1 extra feature compared to the fewest-change option
         - Its confidence is more than 10% higher than the fewest-change winner
    """
    cf_list = list(cfs[:10])
    if not cf_list:
        return None

    def conf(cf):
        return float(cf.counterfactual_data.get('_confidence', 0.5))

    # Step 1: find the fewest-change option (by num_changes, then highest actionability * confidence)
    def cf_score(cf):
        # We consider both confidence and actionability for internal ranking 
        return float(cf.counterfactual_data.get('_confidence', 0.5)) + float(cf.actionability_score)

    min_changes = min(cf.num_changes for cf in cf_list)
    fewest_change_candidates = [cf for cf in cf_list if cf.num_changes == min_changes]
    best_simple = max(fewest_change_candidates, key=cf_score)

    # Step 2: see if any other option with at most 1 extra change has a significantly better score
    for cf in cf_list:
        if cf == best_simple:
            continue
        extra_changes = cf.num_changes - min_changes
        # We use a combined confidence + actionability "gain" to justify an extra change
        score_gain = cf_score(cf) - cf_score(best_simple)
        if extra_changes <= 1 and score_gain > 0.05:
            best_simple = cf  # override

    return best_simple


class PredictionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Prediction operations
    """
    queryset = Prediction.objects.all()
    serializer_class = PredictionSerializer
    
    @action(detail=False, methods=['post'])
    def predict(self, request):
        """
        Make a prediction
        """
        serializer = PredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        try:
            # 1. Fetch model
            ml_model = MLModel.objects.get(id=data['model_id'])
            if not ml_model.is_trained or not ml_model.model_file:
                return Response({'error': 'Model is not trained yet'}, status=status.HTTP_400_BAD_REQUEST)
                
            # 2. Load the pipeline
            pipeline = load_model_pipeline(ml_model)
            
            # 3. Prepare data
            input_dict = data['input_data']
            # Convert scalar values to lists for DataFrame
            df_input = pd.DataFrame([input_dict])
            
            # 4. Predict
            prediction_val = pipeline.predict(df_input)[0]
            
            prediction_probs = None
            if hasattr(pipeline, 'predict_proba'):
                probs = pipeline.predict_proba(df_input)[0]
                prediction_probs = {str(i): float(p) for i, p in enumerate(probs)}
                
            # 5. Save Prediction Record
            prediction_record = Prediction.objects.create(
                model=ml_model,
                input_data=input_dict,
                input_hash=hash_input_data(input_dict),
                prediction_value=float(prediction_val),
                prediction_class=str(prediction_val), # Convert to string for class representation
                prediction_probabilities=prediction_probs,
                created_by=request.user if request.user.is_authenticated else None
            )
            
            # 6. Generate SHAP if requested
            shap_result = None
            if data.get('generate_shap', True):
                preprocessor = pipeline.named_steps['preprocessor']
                classifier = pipeline.named_steps['model']
                
                transformed_input = preprocessor.transform(df_input)
                explainer = shap.TreeExplainer(classifier)
                
                # Get expected value (base value)
                base_value = explainer.expected_value
                if isinstance(base_value, np.ndarray) or isinstance(base_value, list):
                    base_value = float(base_value[-1])  # For multi-class/binary, take positive class
                elif hasattr(base_value, 'item'): 
                    base_value = base_value.item()
                else:
                    base_value = float(base_value)
                    
                shap_vals = explainer.shap_values(transformed_input)
                
                if isinstance(shap_vals, list):
                    shap_vals = shap_vals[1][0] # Positive class, first row
                else:
                    shap_vals = shap_vals[0] # first row
                    
                # Extract feature names after preprocessing
                try:
                    num_names = ml_model.train_metrics.get('continuous_features', [])
                    cat_names = []
                    categorical_features = ml_model.train_metrics.get('categorical_features', [])
                    if categorical_features:
                        cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
                        cat_names = list(cat_encoder.get_feature_names_out(categorical_features))
                    
                    feature_names = num_names + cat_names
                except Exception:
                    # fallback
                    feature_names = [f"feature_{i}" for i in range(len(shap_vals))]
                    
                shap_data = prepare_shap_data(shap_vals, feature_names, base_value)
                
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
                'prediction_probabilities': prediction_probs,
                'shap_explanation': shap_result
            }, status=status.HTTP_200_OK)
            
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
        Find counterfactual explanations
        """
        prediction = self.get_object()
        serializer = CounterfactualRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        try:
            ml_model = prediction.model
            dataset = ml_model.dataset
            
            # 1. Load data
            df = load_clean_dataset(dataset.file.path)
            
            # 2. Load model
            pipeline = load_model_pipeline(ml_model)
            
            # 3. Setup DiCE using the PipelineWrapper so CFs are in raw feature space
            continuous_features = ml_model.train_metrics.get('continuous_features', [])
            target_name = ml_model.target_name

            model_wrapper = PipelineWrapper(pipeline)

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
            
            # 4. Handle frozen features / constraints
            constraints = data.get('feature_constraints', {})
            all_features = ml_model.feature_names
            features_to_vary = "all"
            
            if isinstance(constraints, dict):
                frozen = constraints.get('frozen_features', [])
                if frozen:
                    features_to_vary = [f for f in all_features if f not in frozen]
            
            desired_class = data.get('desired_class', "opposite")
            
            # DRF CharField returns string "1", but DiCE needs integer 1 if the target is int
            if isinstance(desired_class, str):
                if desired_class.isdigit():
                    desired_class = int(desired_class)
                else:
                    try:
                        desired_class = float(desired_class)
                    except ValueError:
                        pass
                        
            num_cf = data.get('max_iterations', 4) # We'll use this as total desired CFs
            
            # Original input as a dataframe
            input_df = pd.DataFrame([prediction.input_data])
            
            # 5. Generate CFs
            dice_exp = exp.generate_counterfactuals(
                input_df,
                total_CFs=num_cf,
                desired_class=desired_class,
                features_to_vary=features_to_vary
            )
            
            cf_df = dice_exp.cf_examples_list[0].final_cfs_df
            if cf_df is None or cf_df.empty:
                return Response({'status': 'no counterfactuals found'}, status=status.HTTP_404_NOT_FOUND)
                
            # Drop the target column to get only features
            if target_name in cf_df.columns:
                target_vals = cf_df[target_name].tolist()
                cf_features_df = cf_df.drop(columns=[target_name])
            else:
                target_vals = [desired_class] * len(cf_df)
                cf_features_df = cf_df
                
            # 6. Save Counterfactuals
            results = []
            original_input = prediction.input_data
            
            # Clear previous for this prediction (optional, but good if regenerating)
            prediction.counterfactuals.all().delete()
            
            for idx, row in cf_features_df.iterrows():
                cf_dict = row.to_dict()
                cf_target = target_vals[idx] if idx < len(target_vals) else desired_class
                
                # We can do a L2 distance if numeric, or just use dice built-in
                changes = get_feature_changes(original_input, cf_dict)
                num_changes = len(changes)
                changed_features = list(changes.keys())
                
                score = calculate_actionability_score(changes)
                
                # Confidence: use the wrapper which handles raw input correctly
                cf_input_df = pd.DataFrame([cf_dict])
                cf_prediction_probs = model_wrapper.predict_proba(cf_input_df)[0]
                try:
                    target_idx = model_wrapper.classes_.tolist().index(cf_target)
                    cf_prob_val = float(cf_prediction_probs[target_idx])
                except Exception:
                    cf_prob_val = float(max(cf_prediction_probs))
                    
                cf_dict['_confidence'] = cf_prob_val
                
                cf_record = Counterfactual.objects.create(
                    prediction=prediction,
                    counterfactual_data=cf_dict,
                    counterfactual_prediction=float(cf_target) if isinstance(cf_target, (int, float, np.number)) else 0.0,
                    counterfactual_class=str(cf_target),
                    distance=float(num_changes), # Simplified distance
                    num_changes=num_changes,
                    changed_features=changed_features,
                    feature_changes=changes,
                    is_actionable=(score > 0.5),
                    actionability_score=score,
                    rank=idx + 1 # Use idx+1 for rank
                )

                results.append({
                    'id': cf_record.id,
                    'counterfactual_data': cf_record.counterfactual_data,
                    'counterfactual_class': cf_record.counterfactual_class,
                    'confidence': cf_prob_val,
                    'feature_changes': cf_record.feature_changes,
                    'num_changes': cf_record.num_changes,
                    'distance_score': cf_record.distance, # Using 'distance' field from model
                    'actionability_score': cf_record.actionability_score
                })
                
            return Response({
                'status': 'counterfactuals generated',
                'counterfactuals': results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'status': 'generation failed',
                 'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def explain(self, request, pk=None):
        """
        Use an LLM to explain the prediction and any generated counterfactuals.
        """
        prediction = self.get_object()

        expected_outcome = request.data.get('expected_outcome')
        expected_label = request.data.get('expected_outcome_label', expected_outcome)
        predicted_label = request.data.get('predicted_outcome_label', prediction.prediction_class)
        
        # New: optional descriptions for flexibility
        target_description = request.data.get('target_description') # e.g. "annual income > $50k"
        feature_descriptions = request.data.get('feature_descriptions', {}) # e.g. {"education-num": "years of education"}

        try:
            api_key = os.environ.get('GEMINI_API_KEY')

            confidence_str = ""
            if prediction.prediction_probabilities:
                conf_val = prediction.prediction_probabilities.get(str(prediction.prediction_class))
                if conf_val:
                    confidence_str = f" with a confidence level of {float(conf_val)*100:.1f}%"

            # Build feature context for the LLM
            input_items = []
            for k, v in prediction.input_data.items():
                desc = feature_descriptions.get(k)
                if desc:
                    input_items.append(f"{k} (meaning {desc}): {v}")
                else:
                    input_items.append(f"{k}: {v}")
            input_data_str = ", ".join(input_items)

            # Define outcome labels with descriptions if provided
            target_text = f"'{expected_label}'"
            if target_description:
                target_text += f" (interpreted as: {target_description})"
            
            predicted_text = f"'{predicted_label}'"
            # We assume if the user provided a description for the expected outcome, they might want one for the predicted too
            # but usually the labels are symmetric. If target_description is missing, we let LLM self-translate.

            prompt = (
                f"You are an expert AI data scientist explaining an XGBoost model prediction to an average user.\n\n"
                f"CONTEXT:\n"
                f"The user provided the following data points:\n{input_data_str}\n\n"
                f"The model initially predicted the outcome to be: {predicted_text}{confidence_str}.\n"
            )

            if expected_outcome is not None:
                prompt += f"The user's goal or expected outcome is: {target_text}.\n\n"

                cfs = prediction.counterfactuals.filter(
                    counterfactual_class=str(expected_outcome)
                ).order_by('-actionability_score') # Logic in _select_best_counterfactual handles tie-breaking

                if cfs.exists():
                    chosen_cf = _select_best_counterfactual(cfs)
                    if chosen_cf:
                        chosen_conf = float(chosen_cf.counterfactual_data.get('_confidence', 0.5))
                        
                        # Build changes list with description mapping
                        change_lines = []
                        for k, v in chosen_cf.feature_changes.items():
                            desc = feature_descriptions.get(k)
                            label_hint = f" ({desc})" if desc else ""
                            change_lines.append(f"  - Change {k}{label_hint} from {v['original']} to {v['counterfactual']}")
                        
                        changes_str = "\n".join(change_lines)

                        prompt += (
                            f"Our system has selected the most realistic path to reach {target_text}:\n\n"
                            f"{changes_str}\n\n"
                            f"This path carries an estimated new confidence of {chosen_conf*100:.1f}%.\n\n"
                            f"TASK:\n"
                            f"1. Explain ONLY the changes listed above in a highly concise, bulleted action plan.\n"
                            f"2. You MUST state the original prediction and how these specific changes flip it to {target_text}.\n"
                            f"3. IMPORTANT: Self-translate any technical labels or condensed feature names (e.g., '>50K', 'capital-gain') "
                            f"into clear, conversational, and actionable English.\n"
                            f"4. Provide realistic, real-world advice on HOW to achieve each change. Use active verbs.\n"
                            f"5. DO NOT provide conversational filler.\n\n"
                            f"Conclude with exactly one line: 'Estimated New Confidence Level: {chosen_conf*100:.1f}% for {expected_label}.'\n"
                        )
                else:
                    if str(expected_outcome) == str(prediction.prediction_class):
                        prompt += "The prediction matches the user's expectations. Please suggest 2-3 ways the user can further improve their current features to make this positive outcome even more secure or increase the confidence level.\n"
                    else:
                        prompt += f"Could you provide general advice on what factors usually influence the outcome to become {expected_outcome}?\n"
            else:
                prompt += "Please provide a brief, intuitive explanation of what this outcome means based on the input data.\n"

            if not api_key:
                mock_explanation = "This is a simulated LLM explanation. To get real explanations, ensure the GEMINI_API_KEY environment variable is set in your .env file.\n\n"
                mock_explanation += f"Based on the prompt we generated: \n\n{prompt}"
                return Response({'explanation': mock_explanation}, status=status.HTTP_200_OK)

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('models/gemini-3.1-flash-lite-preview', system_instruction="You are a helpful analyst who translates machine learning data into clear, human-friendly advice. You always pick the most empathetic and actionable way to describe technical features.")
            response = model.generate_content(prompt)
            return Response({'explanation': response.text}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'status': 'explanation failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
            
            
class CounterfactualViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactuals
    """
    queryset = Counterfactual.objects.all()
    serializer_class = CounterfactualSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        prediction_id = self.request.query_params.get('prediction_id', None)
        if prediction_id:
            queryset = queryset.filter(prediction_id=prediction_id)
        return queryset


class CounterfactualSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactual search jobs
    """
    queryset = CounterfactualSearch.objects.all()
    serializer_class = CounterfactualSearchSerializer

