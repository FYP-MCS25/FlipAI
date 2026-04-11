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
    
    def get_target_column(self):
        """Get the target column for this dataset (if any)"""
        return self.columns.filter(is_target=True).first()
    
    def get_feature_columns(self):
        """Get all feature columns (non-target) for this dataset"""
        return self.columns.filter(is_feature=True, is_target=False)
    
    def get_categorical_columns(self):
        """Get all categorical/binary columns with their unique values for dropdowns"""
        return self.columns.filter(data_type__in=['categorical', 'binary']).exclude(unique_values__isnull=True)


class DatasetColumn(models.Model):
    """
    Model to store information about dataset columns
    """
    FEATURE_TYPE_CHOICES = [
        ('binary', 'Binary'),
        ('categorical', 'Categorical'),
        ('continuous', 'Continuous'),
        ('datetime', 'DateTime'),
        ('text', 'Text'),
        ('unknown', 'Unknown'),
    ]
    
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=50, choices=FEATURE_TYPE_CHOICES, default='unknown')
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
    
    def clean(self):
        """Validate that only one target column exists per dataset"""
        from django.core.exceptions import ValidationError
        
        if self.is_target:
            # Check if another column in this dataset is already marked as target
            existing_targets = DatasetColumn.objects.filter(
                dataset=self.dataset,
                is_target=True
            ).exclude(pk=self.pk)
            
            if existing_targets.exists():
                raise ValidationError(
                    f"Dataset '{self.dataset.name}' already has a target column: "
                    f"'{existing_targets.first().name}'. Only one target column is allowed per dataset."
                )
    
    def is_categorical(self):
        """Check if this column is categorical (includes binary)"""
        return self.data_type in ['categorical', 'binary']
    
    def get_dropdown_values(self):
        """
        Get values suitable for frontend dropdown menus.
        Returns unique values for categorical/binary columns, None for others.
        """
        if self.is_categorical() and self.unique_values:
            return self.unique_values
        return None