import pytest
from django.test import TestCase
from datasets.models import Dataset, DatasetColumn
from django.contrib.auth.models import User


@pytest.mark.django_db
class TestDatasetModel(TestCase):
    """Tests for Dataset model"""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
    
    def test_create_dataset(self):
        """Test creating a dataset"""
        dataset = Dataset.objects.create(
            name='Test Dataset',
            description='Test description',
            uploaded_by=self.user,
        )
        
        assert dataset.name == 'Test Dataset'
        assert dataset.uploaded_by == self.user
        assert not dataset.is_processed
    
    def test_dataset_str(self):
        """Test dataset string representation"""
        dataset = Dataset.objects.create(name='Test Dataset')
        assert str(dataset) == 'Test Dataset'


@pytest.mark.django_db
class TestDatasetColumn(TestCase):
    """Tests for DatasetColumn model"""
    
    def setUp(self):
        self.dataset = Dataset.objects.create(name='Test Dataset')
    
    def test_create_column(self):
        """Test creating a dataset column"""
        column = DatasetColumn.objects.create(
            dataset=self.dataset,
            name='age',
            data_type='numeric',
            min_value=0,
            max_value=100,
        )
        
        assert column.name == 'age'
        assert column.data_type == 'numeric'
        assert column.is_feature
        assert not column.is_target
