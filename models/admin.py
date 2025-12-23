from django.contrib import admin
from .models import MLModel, TrainingJob


@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'model_type', 'task_type', 'is_trained', 'is_pretrained', 'created_at']
    list_filter = ['model_type', 'task_type', 'is_trained', 'is_pretrained']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ['model', 'status', 'progress_percentage', 'started_at', 'completed_at']
    list_filter = ['status', 'created_at']
    readonly_fields = ['started_at', 'completed_at', 'created_at']

