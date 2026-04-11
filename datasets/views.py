from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Dataset, DatasetColumn
from .serializers import DatasetSerializer, DatasetUploadSerializer
from .utils import process_dataset_file, calculate_column_statistics, generate_feature_descriptions
from .uci_metadata import get_uci_metadata_for_dataset, is_known_uci_dataset, map_uci_type_to_feature_type


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
        serializer.save()
    
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
        Process dataset to extract metadata and statistics.
        Also generates human-readable feature descriptions using LLM.
        """
        dataset = self.get_object()
        
        try:
            # Process file and drop NAs
            df, metadata = process_dataset_file(dataset.file.path)
            
            # Update dataset metadata
            dataset.num_rows = metadata['num_rows']
            dataset.num_columns = metadata['num_columns']
            dataset.column_names = metadata['column_names']
            dataset.column_types = metadata['column_types']
            dataset.is_processed = True
            dataset.save()
            
            # Generate feature descriptions using LLM
            print(f"🤖 Generating feature descriptions for {dataset.name}...")
            feature_descriptions = generate_feature_descriptions(
                df,
                metadata['column_names'],
                metadata['column_types'],
                dataset.name
            )
            
            # Try to fetch UCI metadata if this is a known UCI dataset
            uci_metadata = None
            if is_known_uci_dataset(dataset.name):
                print(f"📊 Fetching UCI metadata for {dataset.name}...")
                uci_metadata = get_uci_metadata_for_dataset(dataset.name)
                if uci_metadata:
                    print(f"✅ Successfully fetched UCI metadata for {len(uci_metadata)} columns")
                else:
                    print(f"⚠️  Could not fetch UCI metadata, falling back to heuristics")
            
            # Create/update DatasetColumn records
            dataset.columns.all().delete()  # Clear existing columns first
            
            # Determine target column (only ONE allowed)
            target_column = None
            if uci_metadata:
                # Use UCI metadata to find target
                for col_name, meta in uci_metadata.items():
                    if meta.get('role') == 'target':
                        target_column = col_name
                        break
            else:
                # Fall back to heuristic - find first match
                target_candidates = ['target', 'class', 'label', 'income', 'outcome', 'y']
                for col_name in metadata['column_names']:
                    if col_name.lower() in target_candidates:
                        target_column = col_name
                        break
            
            if target_column:
                print(f"🎯 Identified target column: {target_column}")
            else:
                print(f"⚠️  No target column identified. Please set manually.")
            
            for col_name in metadata['column_names']:
                col_type = metadata['column_types'].get(col_name, 'unknown')
                description = feature_descriptions.get(col_name, '')
                
                # Determine if this is the target column
                is_target = (col_name == target_column)
                
                # Get feature type from UCI metadata if available
                feature_type = col_type  # Default to detected type
                if uci_metadata and col_name in uci_metadata:
                    uci_col_meta = uci_metadata[col_name]
                    feature_type = map_uci_type_to_feature_type(uci_col_meta.get('type', ''))
                
                # Calculate statistics (pass feature_type for proper unique values collection)
                stats = calculate_column_statistics(df, col_name, feature_type)
                
                DatasetColumn.objects.create(
                    dataset=dataset,
                    name=col_name,
                    data_type=feature_type,
                    description=description,
                    is_target=is_target,
                    is_feature=not is_target,
                    min_value=stats.get('min_value'),
                    max_value=stats.get('max_value'),
                    mean_value=stats.get('mean_value'),
                    std_value=stats.get('std_value'),
                    unique_values=stats.get('unique_values'),
                    num_unique=stats.get('num_unique'),
                    missing_count=stats.get('missing_count'),
                    missing_percentage=stats.get('missing_percentage')
                )
                
            return Response({
                'status': 'processing completed',
                'metadata': metadata,
                'feature_descriptions_generated': len(feature_descriptions),
                'uci_metadata_used': uci_metadata is not None,
                'num_columns_processed': len(metadata['column_names']),
                'target_column': target_column
            })
            
        except Exception as e:
            return Response({
                'status': 'processing failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)