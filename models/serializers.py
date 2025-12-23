from rest_framework import serializers
from models.models import MLModel, TrainingJob


class MLModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLModel
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'is_trained']


class TrainingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingJob
        fields = '__all__'
        read_only_fields = ['status', 'progress_percentage', 'started_at', 'completed_at']


class ModelTrainSerializer(serializers.Serializer):
    model_name = serializers.CharField(max_length=255)
    model_type = serializers.ChoiceField(choices=MLModel.MODEL_TYPES)
    task_type = serializers.ChoiceField(choices=MLModel.TASK_TYPES)
    dataset_id = serializers.IntegerField()
    target_column = serializers.CharField(max_length=255)
    feature_columns = serializers.ListField(child=serializers.CharField())
    hyperparameters = serializers.JSONField(required=False)
    train_test_split = serializers.FloatField(default=0.8)
