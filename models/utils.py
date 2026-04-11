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


def compute_shap_weights(
    model: Any,
    X_train_transformed: np.ndarray,
    y_train: Any,
    weight_strength: float = 2.0,
    sample_size: int = 2000
) -> np.ndarray:
    """
    Use SHAP to derive per-sample training weights for the next round.

    Combines:
      - Prediction correctness (misclassified = harder)
      - SHAP alignment (SHAP contributions conflicting with true label = fragile)

    Returns mean-normalised weights (shape = n_train_samples).
    """
    n = len(X_train_transformed)
    sample_sz = min(sample_size, n)

    rng = np.random.RandomState(42)
    sample_idx = rng.choice(n, size=sample_sz, replace=False)
    X_sample = X_train_transformed[sample_idx]
    y_sample = np.array(y_train)[sample_idx]

    y_pred = model.predict(X_sample)
    is_wrong = (y_pred != y_sample).astype(float)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]  # positive class for binary

    # SHAP alignment: positive = SHAP pushes in correct direction
    label_sign = np.where(y_sample == 1, 1.0, -1.0)
    net_shap = shap_values.sum(axis=1)
    alignment = label_sign * net_shap

    a_min, a_max = alignment.min(), alignment.max()
    if a_max - a_min > 1e-8:
        alignment_norm = (alignment - a_min) / (a_max - a_min)
    else:
        alignment_norm = np.ones(sample_sz) * 0.5

    # difficulty: 60% from correctness, 40% from SHAP misalignment
    difficulty = 0.6 * is_wrong + 0.4 * (1.0 - alignment_norm)
    sample_weights = 1.0 + weight_strength * difficulty

    full_weights = np.ones(n, dtype=np.float64)
    full_weights[sample_idx] = sample_weights
    full_weights = full_weights / full_weights.mean()  # mean-normalise

    return full_weights


def build_and_train_pipeline(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: List[str],
    model_type: str,
    task_type: str,
    test_size: float = 0.2,
    hyperparameters: Dict = None,
    max_rounds: int = 5,
    shap_weight_strength: float = 2.0,
) -> Tuple[Any, Dict, Dict, Any]:
    """
    Build a sklearn preprocessing pipeline and train the model using
    SHAP-integrated iterative reweighting (for XGBoost classifiers).

    For tree-based classifiers the training runs max_rounds:
      Round 0 → uniform weights
      Round N → reweight based on SHAP alignment from round N-1
    The model with the best test accuracy across rounds is returned.

    For non-XGBoost or regression task_type, a single round is used.
    """
    X = df[feature_columns]
    y = df[target_column]

    continuous_features, categorical_features = determine_feature_types(df, feature_columns)

    # ── Preprocessing pipeline ──────────────────────────────────────────────
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

    # ── Train / test split ──────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    # Fit preprocessor on training data only
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)

    # ── Extract feature names ────────────────────────────────────────────────
    try:
        num_names = continuous_features
        cat_names = []
        if categorical_features:
            cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
            cat_names = list(cat_encoder.get_feature_names_out(categorical_features))
        feature_names = num_names + cat_names
    except Exception:
        feature_names = [f"feature_{i}" for i in range(X_train_transformed.shape[1])]

    use_shap_loop = (model_type == 'xgboost' and task_type == 'classification')
    n_rounds = max_rounds if use_shap_loop else 1

    best_model = None
    best_accuracy = -1.0
    best_round = 0
    round_log = []
    weights = None  # uniform for round 0

    for rnd in range(n_rounds):
        # ── Build fresh model for this round ─────────────────────────────
        if model_type == 'xgboost':
            base_model = XGBClassifier(**(hyperparameters or {})) if task_type == 'classification' \
                         else XGBRegressor(**(hyperparameters or {}))
        else:
            base_model = get_model_instance(model_type, hyperparameters)

        fit_kwargs = {'sample_weight': weights} if weights is not None else {}
        base_model.fit(X_train_transformed, y_train, **fit_kwargs)

        # ── Evaluate ──────────────────────────────────────────────────────
        y_pred_test = base_model.predict(X_test_transformed)
        y_pred_train = base_model.predict(X_train_transformed)

        # Convert predictions to same type as y for comparison
        y_train_arr = np.array(y_train)
        y_test_arr = np.array(y_test)

        test_acc = float(np.mean(y_pred_test == y_test_arr))
        train_acc = float(np.mean(y_pred_train == y_train_arr))

        if test_acc > best_accuracy:
            best_accuracy = test_acc
            best_model = base_model
            best_round = rnd

        entry = {'round': rnd, 'test_accuracy': round(test_acc, 6), 'train_accuracy': round(train_acc, 6)}

        # ── Compute SHAP weights for next round ───────────────────────────
        if use_shap_loop and rnd < n_rounds - 1:
            try:
                weights = compute_shap_weights(
                    base_model, X_train_transformed, y_train_arr,
                    weight_strength=shap_weight_strength
                )
                n_upweighted = int((weights > 1.5).sum())
                entry['n_upweighted'] = n_upweighted
            except Exception as e:
                print(f"SHAP reweighting failed at round {rnd}: {e}")
                weights = None

        round_log.append(entry)

    # ── Final SHAP global feature importance on best model ───────────────────
    feature_importance = None
    try:
        explainer = shap.TreeExplainer(best_model)
        shap_values = explainer.shap_values(X_train_transformed[:500])
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        feature_importance = dict(
            sorted(
                {feat: float(val) for feat, val in zip(feature_names, mean_abs_shap)}.items(),
                key=lambda item: item[1],
                reverse=True
            )
        )
    except Exception as e:
        print(f"Final SHAP explanation failed: {e}")
        feature_importance = {'error': str(e)}

    # ── Wrap best model back into a full sklearn pipeline ────────────────────
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('model', best_model)
    ])

    metrics = {
        'train_accuracy': round(best_accuracy, 6) if task_type == 'classification' else None,
        'test_accuracy': round(best_accuracy, 6) if task_type == 'classification' else None,
        'train_r2': round(best_accuracy, 6) if task_type == 'regression' else None,
        'test_r2': round(best_accuracy, 6) if task_type == 'regression' else None,
        'continuous_features': continuous_features,
        'categorical_features': categorical_features,
        'best_round': best_round,
        'total_rounds': n_rounds,
        'round_log': round_log,
    }

    return clf, metrics, feature_importance, explainer

