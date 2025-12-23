import pytest
from django.test import TestCase
from predictions.models import Prediction, Counterfactual
from models.models import MLModel


@pytest.mark.django_db
class TestPrediction(TestCase):
    """Tests for Prediction model"""
    
    def setUp(self):
        self.model = MLModel.objects.create(
            name='Test Model',
            model_type='random_forest',
            task_type='classification',
        )
    
    def test_create_prediction(self):
        """Test creating a prediction"""
        prediction = Prediction.objects.create(
            model=self.model,
            input_data={'age': 25, 'income': 50000},
            input_hash='test_hash',
            prediction_value=1.0,
            prediction_class='approved',
        )
        
        assert prediction.prediction_class == 'approved'
        assert prediction.input_data['age'] == 25


@pytest.mark.django_db
class TestCounterfactual(TestCase):
    """Tests for Counterfactual model"""
    
    def setUp(self):
        self.model = MLModel.objects.create(
            name='Test Model',
            model_type='random_forest',
            task_type='classification',
        )
        self.prediction = Prediction.objects.create(
            model=self.model,
            input_data={'age': 25},
            input_hash='test_hash',
            prediction_value=0.0,
        )
    
    def test_create_counterfactual(self):
        """Test creating a counterfactual"""
        cf = Counterfactual.objects.create(
            prediction=self.prediction,
            counterfactual_data={'age': 30},
            counterfactual_prediction=1.0,
            distance=5.0,
            num_changes=1,
            changed_features=['age'],
            feature_changes={'age': {'original': 25, 'counterfactual': 30}},
        )
        
        assert cf.num_changes == 1
        assert cf.distance == 5.0
        assert cf.is_actionable
