from rest_framework import viewsets
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