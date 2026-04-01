from django.db import models
from django.contrib.auth.models import User


class Dataset(models.Model):
    """
    Model to store uploaded datasets
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='datasets/')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Dataset metadata
    num_rows = models.IntegerField(null=True, blank=True)
    num_columns = models.IntegerField(null=True, blank=True)
    column_names = models.JSONField(null=True, blank=True)
    column_types = models.JSONField(null=True, blank=True)
    
    # Processing status
    is_processed = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.name


class DatasetColumn(models.Model):
    """
    Model to store information about dataset columns
    """
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=50)  # numeric, categorical, datetime, text
    is_target = models.BooleanField(default=False)
    is_feature = models.BooleanField(default=True)
    
    # Human-readable description (LLM-generated during processing)
    description = models.TextField(blank=True, default='')
    
    # Statistics for numeric columns
    min_value = models.FloatField(null=True, blank=True)
    max_value = models.FloatField(null=True, blank=True)
    mean_value = models.FloatField(null=True, blank=True)
    std_value = models.FloatField(null=True, blank=True)
    
    # Categorical column info
    unique_values = models.JSONField(null=True, blank=True)
    num_unique = models.IntegerField(null=True, blank=True)
    
    # Missing data
    missing_count = models.IntegerField(default=0)
    missing_percentage = models.FloatField(default=0.0)
    
    class Meta:
        unique_together = ['dataset', 'name']
    
    def __str__(self):
        return f"{self.dataset.name} - {self.name}"

