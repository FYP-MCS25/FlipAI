from django.db import models
from django.contrib.auth.models import User
from models.models import MLModel


class Prediction(models.Model):
    """
    Model to store predictions made by ML models
    """
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='predictions')
    
    # Input data
    input_data = models.JSONField()  # Original input features
    input_hash = models.CharField(max_length=64, db_index=True)  # Hash for quick lookup
    
    # Prediction result
    prediction_value = models.FloatField()
    prediction_class = models.CharField(max_length=255, null=True, blank=True)
    prediction_probabilities = models.JSONField(null=True, blank=True)
    
    # User and timestamps
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['model', 'input_hash']),
        ]
    
    def __str__(self):
        return f"Prediction for {self.model.name} at {self.created_at}"


class Counterfactual(models.Model):
    """
    Model to store counterfactual explanations
    """
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='counterfactuals')
    
    # Counterfactual data
    counterfactual_data = models.JSONField()  # Modified features
    counterfactual_prediction = models.FloatField()
    counterfactual_class = models.CharField(max_length=255, null=True, blank=True)
    
    # Distance metrics
    distance = models.FloatField()  # L2 distance from original
    num_changes = models.IntegerField()  # Number of features changed
    changed_features = models.JSONField()  # List of changed feature names
    
    # Actionability metrics
    is_actionable = models.BooleanField(default=True)
    actionability_score = models.FloatField(null=True, blank=True)
    
    # Feature changes with details
    feature_changes = models.JSONField()  # Detailed change information
    
    # Ranking (for multiple counterfactuals)
    rank = models.IntegerField(default=1)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['rank', 'distance']
    
    def __str__(self):
        return f"Counterfactual #{self.rank} for Prediction {self.prediction.id}"


class SHAPExplanation(models.Model):
    """
    Model to store SHAP explanations for predictions
    """
    prediction = models.OneToOneField(Prediction, on_delete=models.CASCADE, related_name='shap_explanation')
    
    # SHAP values
    shap_values = models.JSONField()  # SHAP values for each feature
    base_value = models.FloatField()  # Base value (expected value)
    
    # Feature importance ranking
    feature_importance = models.JSONField()  # Sorted by absolute SHAP value
    
    # Visualization data
    force_plot_data = models.JSONField(null=True, blank=True)
    waterfall_data = models.JSONField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"SHAP Explanation for Prediction {self.prediction.id}"


class CounterfactualSearch(models.Model):
    """
    Model to track counterfactual search jobs
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='searches')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Search parameters
    max_iterations = models.IntegerField(default=1000)
    desired_class = models.CharField(max_length=255, null=True, blank=True)
    feature_constraints = models.JSONField(null=True, blank=True)
    
    # Results
    num_counterfactuals_found = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    
    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Search for Prediction {self.prediction.id} - {self.status}"

