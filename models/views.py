from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import MLModel, TrainingJob
from .serializers import MLModelSerializer, TrainingJobSerializer, ModelTrainSerializer


class MLModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for MLModel CRUD operations
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    
    @action(detail=False, methods=['post'])
    def train(self, request):
        """
        Train a new model
        """
        serializer = ModelTrainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement model training logic
        return Response({
            'status': 'training started',
            'message': 'Model training has been queued'
        }, status=status.HTTP_202_ACCEPTED)
    
    @action(detail=True, methods=['post'])
    def predict(self, request, pk=None):
        """
        Make prediction with this model
        """
        model = self.get_object()
        # TODO: Implement prediction logic
        return Response({'status': 'prediction endpoint - not implemented yet'})


class TrainingJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing training jobs
    """
    queryset = TrainingJob.objects.all()
    serializer_class = TrainingJobSerializer
    
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

