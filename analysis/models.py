from django.db import models
from datasets.models import Dataset

class Analysis(models.Model):
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE)

    target_feature = models.CharField(max_length=255)
    frozen_features = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis {self.id} - {self.dataset.name}"