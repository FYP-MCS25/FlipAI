from rest_framework.routers import DefaultRouter
from datasets.views import DatasetViewSet
from models.views import MLModelViewSet, TrainingJobViewSet
from predictions.views import PredictionViewSet, CounterfactualViewSet, CounterfactualSearchViewSet

router = DefaultRouter()

# Dataset endpoints
router.register(r'datasets', DatasetViewSet, basename='dataset')

# Model endpoints
router.register(r'models', MLModelViewSet, basename='mlmodel')
router.register(r'training-jobs', TrainingJobViewSet, basename='trainingjob')

# Prediction endpoints
router.register(r'predictions', PredictionViewSet, basename='prediction')
router.register(r'counterfactuals', CounterfactualViewSet, basename='counterfactual')
router.register(r'counterfactual-searches', CounterfactualSearchViewSet, basename='counterfactualsearch')

urlpatterns = router.urls
