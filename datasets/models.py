from django.db import models
from django.contrib.auth.models import User
import csv
from pathlib import Path


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
    
    def process_file(self):
        """
        Read the CSV, fill metadata: num_rows, num_columns, column_names, column_types
        Only support str, int, bool for column types.
        """
        if not self.file:
            return

        # Full path to the uploaded file
        file_path = self.file.path

        with open(file_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

            # Number of rows
            self.num_rows = len(rows)

            # Column names
            self.column_names = reader.fieldnames
            self.num_columns = len(self.column_names)

            # Infer types for each column based on first row
            if rows:
                first_row = rows[0]
                types = {}
                for col, val in first_row.items():
                    if val.lower() in ['true', 'false']:
                        types[col] = 'bool'
                    else:
                        try:
                            int(val)
                            types[col] = 'int'
                        except ValueError:
                            types[col] = 'str'
                self.column_types = types
            else:
                self.column_types = {col: 'str' for col in self.column_names}

        self.save()


class DatasetColumn(models.Model):
    """
    Model to store information about dataset columns
    """
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=50)  # numeric, categorical, datetime, text
    is_target = models.BooleanField(default=False)
    is_feature = models.BooleanField(default=True)
    
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

