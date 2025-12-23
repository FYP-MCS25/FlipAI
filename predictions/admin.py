from django.contrib import admin
from .models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = ['id', 'model', 'prediction_value', 'prediction_class', 'created_at']
    list_filter = ['model', 'created_at']
    search_fields = ['input_hash']
    readonly_fields = ['created_at', 'input_hash']


@admin.register(Counterfactual)
class CounterfactualAdmin(admin.ModelAdmin):
    list_display = ['id', 'prediction', 'rank', 'distance', 'num_changes', 'is_actionable']
    list_filter = ['is_actionable', 'rank']
    readonly_fields = ['created_at']


@admin.register(SHAPExplanation)
class SHAPExplanationAdmin(admin.ModelAdmin):
    list_display = ['id', 'prediction', 'base_value', 'created_at']
    readonly_fields = ['created_at']


@admin.register(CounterfactualSearch)
class CounterfactualSearchAdmin(admin.ModelAdmin):
    list_display = ['id', 'prediction', 'status', 'num_counterfactuals_found', 'created_at']
    list_filter = ['status', 'created_at']
    readonly_fields = ['started_at', 'completed_at', 'created_at']

