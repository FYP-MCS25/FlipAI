"""
Utility functions for model training and management
"""
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier
import joblib
import os
from typing import Dict, Any, Tuple, List
import pandas as pd
from django.conf import settings
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
import numpy as np
import shap


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

def load_model_pipeline(ml_model: Any) -> Any:
    """Load model pipeline seamlessly from MLModel API record"""
    model_path = ml_model.model_file.path
    if not os.path.exists(model_path):
        model_path = os.path.join(settings.MEDIA_ROOT, ml_model.model_file.name)
        
    return joblib.load(model_path)


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


def determine_feature_types(df: pd.DataFrame, feature_columns: List[str]) -> Tuple[List[str], List[str]]:
    """Determine continuous and categorical features"""
    continuous_features = []
    categorical_features = []
    
    for col in feature_columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            # Heuristic: if a numeric column has very few unique values, treat as categorical
            if df[col].nunique() < 10 and not pd.api.types.is_float_dtype(df[col]):
                categorical_features.append(col)
            else:
                continuous_features.append(col)
        else:
            categorical_features.append(col)
            
    return continuous_features, categorical_features


def build_and_train_pipeline(
    df: pd.DataFrame, 
    target_column: str,
    feature_columns: List[str],
    model_type: str,
    task_type: str,
    test_size: float = 0.2,
    hyperparameters: Dict = None
) -> Tuple[Any, Dict, Dict, Any]:
    """Build and train the ML pipeline"""
    
    X = df[feature_columns]
    y = df[target_column]
    
    continuous_features, categorical_features = determine_feature_types(df, feature_columns)
    
    # Preprocessing
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, continuous_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='drop'
    )
    
    # Get model
    if model_type == 'xgboost':
        if task_type == 'classification':
            model = XGBClassifier(**(hyperparameters or {}))
        else:
            model = XGBRegressor(**(hyperparameters or {}))
    else:
        model = get_model_instance(model_type, hyperparameters)
        
    # Full pipeline
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('model', model)
    ])
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    
    # Train
    clf.fit(X_train, y_train)
    
    # Evaluate
    score_train = clf.score(X_train, y_train)
    score_test = clf.score(X_test, y_test)
    
    # Generate SHAP base importance
    feature_names = None
    feature_importance = None
    try:
        # We need raw transformed data for SHAP, or pass TreeExplainer the model directly
        transformed_X = preprocessor.transform(X_train)
        
        # Extract feature names if possible
        num_names = continuous_features
        cat_names = []
        if categorical_features:
            cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
            cat_names = list(cat_encoder.get_feature_names_out(categorical_features))
        
        feature_names = num_names + cat_names
        
        # Calculate SHAP values
        explainer = shap.TreeExplainer(clf.named_steps['model'])
        shap_values = explainer.shap_values(transformed_X[:500])  # subset to save time
        
        if isinstance(shap_values, list): # For multi-class
            shap_values = shap_values[1] # Use positive class
            
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        
        feature_importance = {
            feat: float(val) for feat, val in zip(feature_names, mean_abs_shap)
        }
        # Sort descending
        feature_importance = dict(sorted(feature_importance.items(), key=lambda item: item[1], reverse=True))
    except Exception as e:
        print(f"SHAP explanation failed: {e}")
        feature_importance = {'error': str(e)}

    # Results
    metrics = {
        'train_accuracy': float(score_train) if task_type == 'classification' else None,
        'test_accuracy': float(score_test) if task_type == 'classification' else None,
        'train_r2': float(score_train) if task_type == 'regression' else None,
        'test_r2': float(score_test) if task_type == 'regression' else None,
        'continuous_features': continuous_features,
        'categorical_features': categorical_features
    }
    
    return clf, metrics, feature_importance, explainer
