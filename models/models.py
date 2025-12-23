from django.db import models
from django.contrib.auth.models import User
from datasets.models import Dataset


class MLModel(models.Model):
    """
    Model to store trained machine learning models
    """
    MODEL_TYPES = [
        ('random_forest', 'Random Forest'),
        ('gradient_boosting', 'Gradient Boosting'),
        ('xgboost', 'XGBoost'),
        ('lightgbm', 'LightGBM'),
        ('logistic_regression', 'Logistic Regression'),
        ('svm', 'Support Vector Machine'),
        ('neural_network', 'Neural Network'),
    ]
    
    TASK_TYPES = [
        ('classification', 'Classification'),
        ('regression', 'Regression'),
    ]
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)
    task_type = models.CharField(max_length=20, choices=TASK_TYPES)
    
    # Dataset relationship
    dataset = models.ForeignKey(Dataset, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Model file storage
    model_file = models.FileField(upload_to='models/saved_models/')
    
    # Training metadata
    feature_names = models.JSONField(null=True, blank=True)
    target_name = models.CharField(max_length=255, null=True, blank=True)
    hyperparameters = models.JSONField(null=True, blank=True)
    
    # Performance metrics
    train_accuracy = models.FloatField(null=True, blank=True)
    test_accuracy = models.FloatField(null=True, blank=True)
    train_metrics = models.JSONField(null=True, blank=True)
    test_metrics = models.JSONField(null=True, blank=True)
    
    # Status
    is_trained = models.BooleanField(default=False)
    is_pretrained = models.BooleanField(default=False)  # For models we provide
    
    # User and timestamps
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class TrainingJob(models.Model):
    """
    Model to track training jobs
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='training_jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Training configuration
    train_test_split = models.FloatField(default=0.8)
    random_state = models.IntegerField(default=42)
    
    # Progress tracking
    progress_percentage = models.FloatField(default=0.0)
    current_step = models.CharField(max_length=255, blank=True)
    
    # Results
    error_message = models.TextField(blank=True)
    training_log = models.TextField(blank=True)
    
    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.model.name} - {self.status}"

