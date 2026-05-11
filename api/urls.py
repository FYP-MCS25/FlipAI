from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from api.auth_views import GoogleChallengeView, GoogleSignInView, LogoutView, MeView
from datasets.views import DatasetViewSet
from analysis.views import AnalysisViewSet
from models.views import MLModelViewSet, TrainingJobViewSet
from predictions.views import PredictionViewSet, CounterfactualViewSet, CounterfactualSearchViewSet

router = DefaultRouter()

# Dataset endpoints
router.register(r'datasets', DatasetViewSet, basename='dataset')
router.register(r'analyses', AnalysisViewSet, basename='analysis')

# Model endpoints
router.register(r'models', MLModelViewSet, basename='mlmodel')
router.register(r'training-jobs', TrainingJobViewSet, basename='trainingjob')

# Prediction endpoints
router.register(r'predictions', PredictionViewSet, basename='prediction')
router.register(r'counterfactuals', CounterfactualViewSet, basename='counterfactual')
router.register(r'counterfactual-searches', CounterfactualSearchViewSet, basename='counterfactualsearch')

urlpatterns = [
    path('auth/google-challenge/', GoogleChallengeView.as_view(), name='google-challenge'),
    path('auth/google-sign-in/', GoogleSignInView.as_view(), name='google-sign-in'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
] + router.urls
