from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Dataset, DatasetColumn
from .serializers import DatasetSerializer, DatasetUploadSerializer


class DatasetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Dataset CRUD operations
    """
    queryset = Dataset.objects.all()
    serializer_class = DatasetSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return DatasetUploadSerializer
        return DatasetSerializer
    
    def perform_create(self, serializer):
        # TODO: Add user authentication
        dataset = serializer.save()
        dataset.name = dataset.file.name.split('/')[-1]  # Use CSV filename as name
        dataset.process_file()  # Fill num_rows, num_columns, column_names, column_types
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """
        Get dataset statistics
        """
        dataset = self.get_object()
        # TODO: Implement statistics calculation
        return Response({
            'num_rows': dataset.num_rows,
            'num_columns': dataset.num_columns,
            'columns': dataset.column_names,
        })
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """
        Process dataset to extract metadata and statistics
        """
        dataset = self.get_object()
        # TODO: Implement dataset processing logic
        return Response({'status': 'processing started'})

