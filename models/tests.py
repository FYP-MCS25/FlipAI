import pytest
from django.test import TestCase
from models.models import MLModel, TrainingJob
from datasets.models import Dataset
from django.contrib.auth.models import User


@pytest.mark.django_db
class TestMLModel(TestCase):
    """Tests for MLModel"""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.dataset = Dataset.objects.create(name='Test Dataset')
    
    def test_create_model(self):
        """Test creating an ML model"""
        model = MLModel.objects.create(
            name='Test Model',
            model_type='random_forest',
            task_type='classification',
            dataset=self.dataset,
            created_by=self.user,
        )
        
        assert model.name == 'Test Model'
        assert model.model_type == 'random_forest'
        assert not model.is_trained
    
    def test_model_str(self):
        """Test model string representation"""
        model = MLModel.objects.create(
            name='Test Model',
            model_type='xgboost',
            task_type='classification',
        )
        assert str(model) == 'Test Model'


@pytest.mark.django_db
class TestTrainingJob(TestCase):
    """Tests for TrainingJob"""
    
    def setUp(self):
        self.model = MLModel.objects.create(
            name='Test Model',
            model_type='random_forest',
            task_type='classification',
        )
    
    def test_create_training_job(self):
        """Test creating a training job"""
        job = TrainingJob.objects.create(
            model=self.model,
            status='pending',
        )
        
        assert job.status == 'pending'
        assert job.progress_percentage == 0.0
