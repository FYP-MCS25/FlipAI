from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import MLModel, TrainingJob
from .serializers import MLModelSerializer, TrainingJobSerializer, ModelTrainSerializer
import os
import uuid
from django.conf import settings
from datasets.models import Dataset
from datasets.models import DatasetColumn
from datasets.utils import load_clean_dataset
from .utils import build_and_train_pipeline, save_model


class MLModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for MLModel CRUD operations
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MLModel.objects.filter(created_by=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['post'])
    def train(self, request):
        """
        Train a new model
        """
        serializer = ModelTrainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Start training process
        try:
            dataset = Dataset.objects.get(id=data['dataset_id'], uploaded_by=request.user)
            df = load_clean_dataset(dataset.file.path)
                
            # Create MLModel entry
            model_record = MLModel.objects.create(
                name=data['model_name'],
                model_type=data['model_type'],
                task_type=data['task_type'],
                dataset=dataset,
                target_name=data['target_column'],
                feature_names=data['feature_columns'],
                hyperparameters=data.get('hyperparameters', {}),
                created_by=request.user if request.user.is_authenticated else None
            )
            
            job = TrainingJob.objects.create(
                model=model_record,
                status='running',
                train_test_split=data.get('train_test_split', 0.8)
            )

            label_mapping = None  # will be None for numeric targets

            try:
                target_col_record = DatasetColumn.objects.get(
                    dataset=dataset,
                    name=data['target_column']
                )
                dropdown_values = target_col_record.get_dropdown_values()

                if dropdown_values:
                    # Map each unique value to its index position in the dropdown list
                    # e.g. ['No', 'Yes'] -> {'No': 0, 'Yes': 1}
                    label_mapping = {val: idx for idx, val in enumerate(dropdown_values)}
                    df[data['target_column']] = df[data['target_column']].map(label_mapping)

                    # Catch unmapped values (values in data but missing from dropdown_values)
                    if df[data['target_column']].isna().any():
                        raise ValueError(
                            f"Target column '{data['target_column']}' contains values not "
                            f"found in dropdown list: {dropdown_values}"
                        )

            except DatasetColumn.DoesNotExist:
                pass  # No column metadata - leave target as-is (numeric targets)
            
            # Train pipeline (this is blocking but we'll do it synchronously for simplicity in this endpoint)
            pipeline, metrics, importance, _ = build_and_train_pipeline(
                df=df,
                target_column=data['target_column'],
                feature_columns=data['feature_columns'],
                model_type=data['model_type'],
                task_type=data['task_type'],
                test_size=1.0 - data.get('train_test_split', 0.8),
                hyperparameters=data.get('hyperparameters', {})
            )
            
            # Save the trained model pipeline
            model_filename = f"{uuid.uuid4().hex}.joblib"
            save_path = os.path.join('models/saved_models', model_filename)
            
            # Let's save physically to the path where Django expects
            os.makedirs(os.path.join(settings.MEDIA_ROOT, 'models/saved_models'), exist_ok=True)
            full_save_path = os.path.join(settings.MEDIA_ROOT, save_path)
            
            save_model(pipeline, full_save_path)
            
            model_record.model_file.name = save_path
            model_record.train_accuracy = metrics.get('train_accuracy')
            model_record.test_accuracy = metrics.get('test_accuracy')
            model_record.train_metrics = metrics
            model_record.is_trained = True
            if importance is not None:
                # Store it in train_metrics or specific field
                model_record.train_metrics['feature_importance'] = importance
                
            model_record.save()
            
            job.status = 'completed'
            job.progress_percentage = 100.0
            job.save()
            
            return Response({
                'status': 'training completed',
                'model_id': model_record.id,
                'metrics': metrics,
                'feature_importance': importance
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            if 'job' in locals():
                job.status = 'failed'
                job.error_message = str(e)
                job.save()
                
            return Response({
                'status': 'training failed',
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class TrainingJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing training jobs
    """
    queryset = TrainingJob.objects.all()
    serializer_class = TrainingJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TrainingJob.objects.filter(model__created_by=self.request.user).order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """
        Get training job status
        """
        job = self.get_object()
        return Response({
            'status': job.status,
            'progress': job.progress_percentage,
            'current_step': job.current_step,
        })

