from rest_framework import serializers
from predictions.models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch


class PredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prediction
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'input_hash']


class CounterfactualSerializer(serializers.ModelSerializer):
    class Meta:
        model = Counterfactual
        fields = '__all__'


class SHAPExplanationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SHAPExplanation
        fields = '__all__'


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
