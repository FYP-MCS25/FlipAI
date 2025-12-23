from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Prediction, Counterfactual, SHAPExplanation, CounterfactualSearch
from .serializers import (
    PredictionSerializer, 
    CounterfactualSerializer, 
    SHAPExplanationSerializer,
    CounterfactualSearchSerializer,
    PredictRequestSerializer,
    CounterfactualRequestSerializer
)


class PredictionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Prediction operations
    """
    queryset = Prediction.objects.all()
    serializer_class = PredictionSerializer
    
    @action(detail=False, methods=['post'])
    def predict(self, request):
        """
        Make a prediction
        """
        serializer = PredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement prediction logic
        return Response({
            'status': 'prediction endpoint - not implemented yet',
            'message': 'Prediction logic will be implemented here'
        }, status=status.HTTP_501_NOT_IMPLEMENTED)
    
    @action(detail=True, methods=['get'])
    def shap(self, request, pk=None):
        """
        Get SHAP explanation for a prediction
        """
        prediction = self.get_object()
        # TODO: Get or generate SHAP explanation
        return Response({'status': 'SHAP endpoint - not implemented yet'})
    
    @action(detail=True, methods=['post'])
    def find_counterfactuals(self, request, pk=None):
        """
        Find counterfactual explanations
        """
        prediction = self.get_object()
        serializer = CounterfactualRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement counterfactual search
        return Response({
            'status': 'counterfactual search started',
            'message': 'Search will be implemented here'
        }, status=status.HTTP_202_ACCEPTED)


class CounterfactualViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactuals
    """
    queryset = Counterfactual.objects.all()
    serializer_class = CounterfactualSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        prediction_id = self.request.query_params.get('prediction_id', None)
        if prediction_id:
            queryset = queryset.filter(prediction_id=prediction_id)
        return queryset


class CounterfactualSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing counterfactual search jobs
    """
    queryset = CounterfactualSearch.objects.all()
    serializer_class = CounterfactualSearchSerializer

