from django.contrib import admin
from .models import Dataset, DatasetColumn


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ['name', 'uploaded_by', 'uploaded_at', 'num_rows', 'num_columns', 'is_processed']
    list_filter = ['is_processed', 'uploaded_at']
    search_fields = ['name', 'description']
    readonly_fields = ['uploaded_at', 'updated_at']


@admin.register(DatasetColumn)
class DatasetColumnAdmin(admin.ModelAdmin):
    list_display = ['name', 'dataset', 'data_type', 'is_target', 'is_feature', 'missing_percentage']
    list_filter = ['data_type', 'is_target', 'is_feature']
    search_fields = ['name', 'dataset__name']