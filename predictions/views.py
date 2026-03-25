from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch
from .serializers import (
    PredictionSerializer, 
    CounterfactualSerializer, 
    SHAPExplanationSerializer,
    CounterfactualSearchSerializer,
    PredictRequestSerializer,
    CounterfactualRequestSerializer
)


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
            import pandas as pd
            import numpy as np
            import shap
            from models.utils import load_model
            from models.models import MLModel
            from .utils import hash_input_data, prepare_shap_data
            
            # 1. Fetch model
            ml_model = MLModel.objects.get(id=data['model_id'])
            if not ml_model.is_trained or not ml_model.model_file:
                return Response({'error': 'Model is not trained yet'}, status=status.HTTP_400_BAD_REQUEST)
                
            # 2. Load the pipeline
            from django.conf import settings
            import os
            
            # Handle potential absolute/relative path differences
            model_path = ml_model.model_file.path
            if not os.path.exists(model_path):
                # Fallback to MEDIA_ROOT manual join if needed
                model_path = os.path.join(settings.MEDIA_ROOT, ml_model.model_file.name)
                
            pipeline = load_model(model_path)
            
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
            import pandas as pd
            import numpy as np
            import dice_ml
            from models.utils import load_model
            from django.conf import settings
            import os
            from .utils import calculate_distance, get_feature_changes, calculate_actionability_score
            
            ml_model = prediction.model
            dataset = ml_model.dataset
            
            # 1. Load data
            if dataset.file.path.endswith('.csv'):
                df = pd.read_csv(dataset.file.path)
            else:
                df = pd.read_excel(dataset.file.path)
            df = df.dropna()
            
            # 2. Load model
            model_path = ml_model.model_file.path
            if not os.path.exists(model_path):
                model_path = os.path.join(settings.MEDIA_ROOT, ml_model.model_file.name)
            pipeline = load_model(model_path)
            
            # 3. Setup DiCE
            continuous_features = ml_model.train_metrics.get('continuous_features', [])
            target_name = ml_model.target_name
            
            d = dice_ml.Data(dataframe=df, continuous_features=continuous_features, outcome_name=target_name)
            m = dice_ml.Model(model=pipeline, backend="sklearn")
            exp = dice_ml.Dice(d, m, method="random") # robust method for sklearn pipelines
            
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
                
                # Predict confidence for the counterfactual BEFORE saving
                cf_input_df = pd.DataFrame([cf_dict])
                cf_prediction_probs = pipeline.predict_proba(cf_input_df)[0]
                try:
                    target_idx = pipeline.classes_.tolist().index(cf_target)
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
        
        # Check if user expects a certain outcome
        expected_outcome = request.data.get('expected_outcome')
        expected_label = request.data.get('expected_outcome_label', expected_outcome)
        predicted_label = request.data.get('predicted_outcome_label', prediction.prediction_class)
        
        try:
            import os
            import google.generativeai as genai
            api_key = os.environ.get('GEMINI_API_KEY')
            
            # Calculate confidence level
            confidence_str = ""
            if prediction.prediction_probabilities:
                conf = prediction.prediction_probabilities.get(str(prediction.prediction_class))
                if conf:
                    confidence_str = f" with a confidence level of {float(conf)*100:.1f}%"
            
            # Formulate the prompt
            input_data_str = ", ".join([f"{k}: {v}" for k, v in prediction.input_data.items()])
            
            prompt = f"You are an expert AI data scientist helping a user understand a machine learning prediction.\n\n"
            prompt += f"The user provided the following data points:\n{input_data_str}\n\n"
            prompt += f"The ML model initially predicted the outcome to be: '{predicted_label}'{confidence_str}.\n"
            
            if expected_outcome is not None:
                prompt += f"The user expected the outcome to be: '{expected_label}'.\n\n"
                
                # Check for counterfactuals
                cfs = prediction.counterfactuals.filter(counterfactual_class=str(expected_outcome)).order_by('rank')
                if cfs.exists():
                    prompt += f"Our optimization engine generated {cfs.count()} alternative scenarios to achieve the outcome of '{expected_label}'.\n"
                    for i, cf in enumerate(cfs[:10]):
                        conf_val = cf.counterfactual_data.get('_confidence', 0.51)
                        changes_str = ", ".join([f"{k} from {v['original']} to {v['counterfactual']}" for k, v in cf.feature_changes.items()])
                        prompt += f"Option {i+1} (Confidence: {conf_val*100:.1f}%): Change {changes_str}\n"
                    
                    prompt += "\nTASK: Analyze these generated options and silently select the single most realistic and achievable path for a human being.\n"
                    prompt += f"Then, output a highly concise, bulleted action plan strictly based on that chosen option. You MUST explicitly state the original prediction confidence ({confidence_str.strip()}) and explain that making these exact changes guarantees overcoming the threshold to achieve the '{expected_label}' goal. You MUST include the exact numbers and feature names from your chosen option (e.g., 'Increase capital-gain to 14085' or 'Change occupation to Sales'). Provide realistic, real-world advice on how to achieve these specific target numbers. Use active verbs. DO NOT mention the other options. DO NOT provide conversational filler.\n"
                    prompt += f"\nFinally, conclude with a single line stating the exact confidence level attached to your chosen option (e.g., 'Estimated New Confidence Level: [insert percentage from chosen option]% for {expected_label}').\n"
                else:
                    if str(expected_outcome) == str(prediction.prediction_class):
                        # Matched expectations
                        prompt += "The prediction matches the user's expectations. Please suggest 2-3 ways the user can further improve their current features to make this positive outcome even more secure or increase the confidence level.\n"
                    else:
                        prompt += f"Could you provide general advice on what factors usually influence the outcome to become {expected_outcome}?\n"
            else:
                prompt += "Please provide a brief, intuitive explanation of what this outcome means based on the input data.\n"
            
            if not api_key:
                # Mock response if no API key
                mock_explanation = "This is a simulated LLM explanation. To get real explanations, ensure the GEMINI_API_KEY environment variable is set in your .env file.\n\n"
                mock_explanation += f"Based on the prompt we generated: \n\n{prompt}"
                return Response({'explanation': mock_explanation}, status=status.HTTP_200_OK)
                
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('models/gemini-2.5-flash', system_instruction="You are a helpful analyst explaining ML model predictions to average users.")
            response = model.generate_content(prompt)
            
            explanation = response.text
            
            return Response({'explanation': explanation}, status=status.HTTP_200_OK)
            
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

