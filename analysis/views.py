from rest_framework import viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Analysis
from .serializers import AnalysisSerializer


class AnalysisViewSet(viewsets.ModelViewSet):
    queryset = Analysis.objects.all()
    serializer_class = AnalysisSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Analysis.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        dataset = serializer.validated_data.get('dataset')
        model = serializer.validated_data.get('model')

        if dataset.uploaded_by_id != self.request.user.id:
            raise PermissionDenied('You do not have access to this dataset.')

        if model and model.created_by_id != self.request.user.id:
            raise PermissionDenied('You do not have access to this model.')

        serializer.save(user=self.request.user)

    @action(detail=True, methods=['get'])
    def predictions(self, request, pk=None):
        """
        Retrieve all prediction history associated with this analysis.
        """
        analysis = self.get_object()
        
        # If the analysis doesn't have a model yet, return empty list
        if not analysis.model:
            return Response([])

        # We import these locally to avoid potential circular dependency issues
        from predictions.models import Prediction
        from predictions.serializers import PredictionSerializer

        # Fetch all predictions linked to the model used in this analysis
        predictions = Prediction.objects.filter(
            model=analysis.model
        ).order_by('-created_at')
        
        serializer = PredictionSerializer(predictions, many=True)
        return Response(serializer.data)
