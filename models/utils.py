"""
Utility functions for model training and management
"""
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import joblib
from typing import Dict, Any


MODEL_CLASSES = {
    'random_forest': RandomForestClassifier,
    'gradient_boosting': GradientBoostingClassifier,
    'xgboost': XGBClassifier,
    'lightgbm': LGBMClassifier,
    'logistic_regression': LogisticRegression,
    'svm': SVC,
}


def get_model_instance(model_type: str, hyperparameters: Dict = None) -> Any:
    """
    Get model instance based on type
    
    Args:
        model_type: Type of model
        hyperparameters: Model hyperparameters
        
    Returns:
        Model instance
    """
    if model_type not in MODEL_CLASSES:
        raise ValueError(f"Unsupported model type: {model_type}")
    
    model_class = MODEL_CLASSES[model_type]
    params = hyperparameters or {}
    
    return model_class(**params)


def save_model(model: Any, file_path: str) -> None:
    """
    Save trained model to file
    
    Args:
        model: Trained model
        file_path: Path to save model
    """
    joblib.dump(model, file_path)


def load_model(file_path: str) -> Any:
    """
    Load model from file
    
    Args:
        file_path: Path to model file
        
    Returns:
        Loaded model
    """
    return joblib.load(file_path)


def get_default_hyperparameters(model_type: str) -> Dict:
    """
    Get default hyperparameters for model type
    
    Args:
        model_type: Type of model
        
    Returns:
        Dictionary of default hyperparameters
    """
    defaults = {
        'random_forest': {
            'n_estimators': 100,
            'max_depth': 10,
            'random_state': 42,
        },
        'gradient_boosting': {
            'n_estimators': 100,
            'learning_rate': 0.1,
            'max_depth': 3,
            'random_state': 42,
        },
        'xgboost': {
            'n_estimators': 100,
            'learning_rate': 0.1,
            'max_depth': 6,
            'random_state': 42,
        },
        'lightgbm': {
            'n_estimators': 100,
            'learning_rate': 0.1,
            'max_depth': -1,
            'random_state': 42,
        },
        'logistic_regression': {
            'max_iter': 1000,
            'random_state': 42,
        },
        'svm': {
            'kernel': 'rbf',
            'random_state': 42,
        },
    }
    
    return defaults.get(model_type, {})
