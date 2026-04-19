from django.db import models
from django.conf import settings
from datasets.models import Dataset
from models.models import MLModel

class Analysis(models.Model):
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    analysis_name = models.CharField(max_length=255, default="Untitled Analysis")
    description = models.TextField(blank=True)

    model_type = models.CharField(max_length=50, default="unknown")
    model = models.ForeignKey(MLModel, on_delete=models.SET_NULL, null=True, blank=True)
    target_feature = models.CharField(max_length=255)
    frozen_features = models.JSONField(default=list)
    feature_list = models.JSONField(default=list)
    num_features = models.IntegerField(null=True, blank=True)

    status = models.CharField(max_length=20, default='active')
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'dataset', 'analysis_name')

    def __str__(self):
        return f"Analysis {self.id} - {self.analysis_name} ({self.dataset.name})"