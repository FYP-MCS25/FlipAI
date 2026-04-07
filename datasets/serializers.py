from rest_framework import serializers
from datasets.models import Dataset, DatasetColumn


class DatasetColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetColumn
        fields = '__all__'


class DatasetSerializer(serializers.ModelSerializer):
    columns = DatasetColumnSerializer(many=True, read_only=True)
    
    class Meta:
        model = Dataset
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'uploaded_at', 'updated_at', 'is_processed']


class DatasetUploadSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)  # auto-filled from file
    class Meta:
        model = Dataset
        fields = '__all__'
