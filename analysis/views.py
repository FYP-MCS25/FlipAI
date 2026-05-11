from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

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