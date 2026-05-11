from rest_framework import serializers
from predictions.models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch


class SHAPExplanationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SHAPExplanation
        fields = '__all__'

class CounterfactualSerializer(serializers.ModelSerializer):
    class Meta:
        model = Counterfactual
        fields = [
            'id', 'prediction', 'counterfactual_data', 'counterfactual_prediction',
            'counterfactual_class', 'distance', 'num_changes', 'changed_features',
            'is_actionable', 'actionability_score', 'feature_changes', 'rank',
            'explanation', 'created_at'
        ]
        read_only_fields = ['created_at']

class PredictionSerializer(serializers.ModelSerializer):
    shap_explanation = SHAPExplanationSerializer(read_only=True)
    counterfactuals = CounterfactualSerializer(many=True, read_only=True)

    class Meta:
        model = Prediction
        fields = [
            'id', 'model', 'input_data', 'prediction_value', 
            'prediction_class', 'prediction_probabilities', 
            'created_at', 'shap_explanation', 'counterfactuals', 'llm_summary'
        ]
        read_only_fields = ['created_by', 'created_at', 'input_hash']


class CounterfactualSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = CounterfactualSearch
        fields = '__all__'
        read_only_fields = ['status', 'num_counterfactuals_found', 'started_at', 'completed_at']


class PredictRequestSerializer(serializers.Serializer):
    model_id = serializers.IntegerField()
    input_data = serializers.JSONField()
    generate_shap = serializers.BooleanField(default=True)


class CounterfactualRequestSerializer(serializers.Serializer):
    prediction_id = serializers.IntegerField()
    desired_class = serializers.CharField(required=False)
    max_iterations = serializers.IntegerField(default=1000)
    feature_constraints = serializers.JSONField(required=False)
