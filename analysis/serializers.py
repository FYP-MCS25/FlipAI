from rest_framework import serializers
from .models import Analysis

class AnalysisSerializer(serializers.ModelSerializer):
    dataset_name = serializers.CharField(source='dataset.name', read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Analysis
        fields = [
            'id', 'dataset', 'dataset_name', 'user', 'user_username',
            'analysis_name', 'description',
            'model_type', 'model', 'model_name',
            'target_feature', 'frozen_features', 'feature_list', 'num_features',
            'status', 'error_message',
            'created_at', 'updated_at',
        ]