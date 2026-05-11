from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Analysis
from .serializers import AnalysisSerializer

class AnalysisViewSet(viewsets.ModelViewSet):
    queryset = Analysis.objects.all()
    serializer_class = AnalysisSerializer

    def perform_create(self, serializer):
        # Hardcode to superuser with id=1 until authentication is implemented
        User = get_user_model()
        superuser = User.objects.get(id=1)
        serializer.save(user=superuser)

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