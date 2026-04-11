"""
Adult Dataset Pipeline Test Script

This script tests the complete ML pipeline:
1. Dataset creation and upload
2. Dataset processing
3. Model training
4. Prediction with SHAP explanations
5. Counterfactual generation
6. LLM-powered explanations
"""

from __future__ import annotations

import json
import os
from typing import Dict, Any, Tuple, Optional, TYPE_CHECKING

import requests

if TYPE_CHECKING:
    import pandas as pd

# Optional dependencies
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    pd = None

try:
    from ucimlrepo import fetch_ucirepo
    UCIMLREPO_AVAILABLE = True
except ImportError:
    UCIMLREPO_AVAILABLE = False
    fetch_ucirepo = None

# Constants
BASE_URL = "http://127.0.0.1:8000/api/v1"
CSV_FILENAME = "adult_data.csv"
FROZEN_FEATURES = ["age", "sex", "race", "native-country"]
FEATURE_DESCRIPTIONS = {
    "capital-gain": "yearly profits from investments or asset sales",
    "capital-loss": "yearly losses from investments or asset sales",
    "education-num": "years of formal education",
    "education": "highest level of education completed",
    "hours-per-week": "number of hours worked each week",
    "workclass": "type of employer or work arrangement",
    "occupation": "type of job or profession",
    "relationship": "family relationship status",
    "marital-status": "current marital situation"
}


# ============================================================================
#                               Utility Functions
# ============================================================================

def print_step(step_name: str) -> None:
    """Print a formatted step header."""
    print(f"\n{'='*50}")
    print(f"STEP: {step_name}")
    print(f"{'='*50}")


def check_dependencies() -> bool:
    """Check if required dependencies are available."""
    if not PANDAS_AVAILABLE:
        print("❌ Missing dependency. Please run: pip install pandas")
        return False
    return True


def check_server() -> bool:
    """Check if Django server is running."""
    try:
        requests.get("http://127.0.0.1:8000/", timeout=5)
        return True
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Django server is not running!")
        print("Please run 'python manage.py runserver' in another terminal first.")
        return False


def make_api_request(method: str, endpoint: str, **kwargs) -> Optional[Dict[str, Any]]:
    """
    Make an API request and handle errors uniformly.
    
    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint
        **kwargs: Additional arguments for requests
        
    Returns:
        Response JSON or None on error
    """
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        response = requests.request(method, url, **kwargs)
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            print(f"❌ API Error ({response.status_code}): {response.text}")
            return None
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        return None


# ============================================================================
#                                Dataset Functions
# ============================================================================

def load_or_fetch_dataset() -> Tuple[Any, Optional[str]]:
    """
    Load dataset from local file or fetch from UCI.
    
    Returns:
        Tuple of (DataFrame, target_column_name) or (None, None) on error
    """
    if not PANDAS_AVAILABLE:
        return None, None
    
    # Try loading from existing file
    if os.path.exists(CSV_FILENAME):
        print(f"✅ Found existing dataset: {CSV_FILENAME}")
        print("Loading from local file...")
        df = pd.read_csv(CSV_FILENAME)
        
        # Detect target column
        if 'income' in df.columns:
            target_col = 'income'
        else:
            target_col = df.columns[-1]
        
        print(f"Using target column: {target_col}")
        return df, target_col
    
    # Fetch from UCI
    if not UCIMLREPO_AVAILABLE:
        print("❌ Missing dependency. Please run: pip install ucimlrepo")
        return None, None
    
    print("Dataset not found locally. Fetching from UCI...")
    adult = fetch_ucirepo(id=2)
    X = adult.data.features
    y = adult.data.targets
    
    # Combine features and target
    df = pd.concat([X, y], axis=1)
    df = df.dropna()
    
    # Process target column
    target_col = y.columns[0]
    df[target_col] = df[target_col].astype(str).str.replace('.', '', regex=False)
    df[target_col] = df[target_col].map({'<=50K': 0, '>50K': 1})
    df = df.dropna()
    
    # Save for future use
    df.to_csv(CSV_FILENAME, index=False)
    print(f"✅ Dataset saved to {CSV_FILENAME} for future use")
    
    return df, target_col


def upload_dataset() -> Optional[int]:
    """
    Upload dataset to Django API.
    
    Returns:
        Dataset ID or None on error
    """
    print("Uploading to Django API...")
    
    with open(CSV_FILENAME, 'rb') as f:
        files = {'file': (CSV_FILENAME, f, 'text/csv')}
        data = {
            'name': 'Adult Dataset',
            'description': 'UCI Adult Income Dataset'
        }
        
        response = make_api_request('POST', 'datasets/', files=files, data=data)
        
        if response:
            dataset_id = response['id']
            print(f"✅ Dataset uploaded successfully! ID: {dataset_id}")
            return dataset_id
    
    return None


# ============================================================================
#                   Model Training and Prediction Functions
# ============================================================================

def process_dataset(dataset_id: int) -> bool:
    """Process dataset and return success status."""
    response = make_api_request('POST', f'datasets/{dataset_id}/process/')
    
    if response:
        num_rows = response.get('metadata', {}).get('num_rows')
        print(f"✅ Dataset processed! Metadata found: {num_rows} rows")
        return True
    
    return False


def train_model(dataset_id: int, df: Any, target_col: str) -> Optional[int]:
    """
    Train XGBoost model.
    
    Args:
        dataset_id: Dataset ID
        df: Pandas DataFrame with the dataset
        target_col: Name of the target column
    
    Returns:
        Model ID or None on error
    """
    feature_cols = [c for c in df.columns if c != target_col]
    
    train_data = {
        "model_name": "Adult Income XGBoost Model",
        "model_type": "xgboost",
        "task_type": "classification",
        "dataset_id": dataset_id,
        "target_column": target_col,
        "feature_columns": feature_cols,
        "train_test_split": 0.8
    }
    
    print("Training model... (this may take a few seconds)")
    response = make_api_request('POST', 'models/train/', json=train_data)
    
    if response:
        model_id = response['model_id']
        metrics = response['metrics']
        print(f"✅ Model trained successfully! ID: {model_id}")
        print(f"📊 Training Accuracy: {metrics.get('train_accuracy')}")
        print(f"📊 Test Accuracy: {metrics.get('test_accuracy')}")
        return model_id
    
    return None


def make_prediction(model_id: int, df: Any, target_col: str) -> Optional[Dict[str, Any]]:
    """
    Make a prediction on a sample from the dataset.
    
    Args:
        model_id: Trained model ID
        df: Pandas DataFrame with the dataset
        target_col: Name of the target column
    
    Returns:
        Dictionary with prediction details or None on error
    """
    # Pick someone who makes <=50K (mapped to 0)
    low_income_subject = df[df[target_col] == 0].iloc[0]
    sample_person = low_income_subject.drop(target_col).to_dict()
    
    predict_data = {
        "model_id": model_id,
        "input_data": sample_person,
        "generate_shap": True
    }
    
    print("Making prediction for the following profile:")
    print(json.dumps(sample_person, indent=2))
    
    response = make_api_request('POST', 'predictions/predict/', json=predict_data)
    
    if response:
        prediction_id = response['prediction_id']
        pred_value = response.get('prediction_class', response.get('prediction_value'))
        probs = response.get('prediction_probabilities')
        
        conf_str = ""
        if probs and str(pred_value) in probs:
            conf_str = f"[Confidence: {float(probs[str(pred_value)])*100:.1f}%]"
        
        print(f"✅ Prediction made successfully! {conf_str} ID: {prediction_id}")
        print(f"🔮 Predicted Value: {pred_value} (Actual: <=50K)")
        
        shap_data = response.get('shap_explanation', {})
        if shap_data:
            print(f"📈 Top SHAP Feature Impacts:")
            for feature in shap_data.get('feature_importance', [])[:3]:
                print(f"   - {feature['feature']}: {feature['shap_value']:.4f}")
        
        return {
            'prediction_id': prediction_id,
            'predicted_value': pred_value,
            'actual_label': "<=50K"
        }
    
    return None


# ============================================================================
#                           Counterfactual Functions
# ============================================================================

def display_counterfactual_group(combo_key: str, cf_list: list) -> None:
    """Display a group of counterfactuals."""
    features = combo_key.split(',') if combo_key else []
    print(f"🔹 Feature Combination: {', '.join(features)}")
    print(f"   ({len(cf_list)} options)")
    
    for i, cf in enumerate(cf_list[:3], start=1):
        conf = cf.get('confidence')
        conf_str = f"[Confidence: {conf*100:.1f}%]" if conf is not None else ""
        score_str = f"[Score: {cf.get('combined_score', 0):.3f}]"
        changes = cf.get('feature_changes', {})
        changes_str = ", ".join([
            f"{k}: {v['original']} -> {v['counterfactual']}"
            for k, v in changes.items()
        ])
        print(f"     {i}. {conf_str} {score_str} {changes_str}")
    
    if len(cf_list) > 3:
        print(f"     ... and {len(cf_list) - 3} more options")
    print()


def generate_counterfactuals(prediction_id: int, pred_value: Any) -> Optional[Dict[str, Any]]:
    """
    Generate counterfactual explanations.
    
    Returns:
        Dictionary with grouped counterfactuals or None on error
    """
    desired_class = 1 if int(float(pred_value)) == 0 else 0
    desired_label = ">50K" if desired_class == 1 else "<=50K"
    
    cf_data = {
        "prediction_id": prediction_id,
        "desired_class": desired_class,
        "max_iterations": 10,
        "feature_constraints": {
            "frozen_features": FROZEN_FEATURES
        }
    }
    
    print(f"Finding counterfactuals to achieve: {desired_label} (Class {desired_class})")
    response = make_api_request('POST', f'predictions/{prediction_id}/find_counterfactuals/', json=cf_data)
    
    if response:
        grouped_cfs = response.get('grouped_counterfactuals', {})
        total_generated = response.get('total_generated', 0)
        unique_combos = response.get('unique_feature_combinations', 0)
        
        print(f"✅ Generated {total_generated} total counterfactuals across {unique_combos} unique feature combinations!")
        print()
        
        if grouped_cfs:
            for combo_key, cf_list in grouped_cfs.items():
                display_counterfactual_group(combo_key, cf_list)
        
        return {
            'desired_class': desired_class,
            'desired_label': desired_label,
            'grouped_counterfactuals': grouped_cfs,
            'total_generated': total_generated,
            'unique_combos': unique_combos
        }
    
    return None


def generate_explanation(prediction_id: int, cf_data: Dict[str, Any], actual_label: str) -> bool:
    """
    Generate LLM explanation using Gemini.
    
    Feature descriptions are now auto-fetched from the database during dataset processing.
    
    Returns:
        Success status
    """
    target_desc = (
        "annual income of more than $50,000"
        if cf_data['desired_class'] == 1
        else "annual income of $50,000 or less"
    )
    
    explain_data = {
        "expected_outcome": cf_data['desired_class'],
        "expected_outcome_label": cf_data['desired_label'],
        "predicted_outcome_label": actual_label,
        "target_description": target_desc,
        # Feature descriptions are auto-fetched from database - no need to send them
        # "feature_descriptions": FEATURE_DESCRIPTIONS,  # <-- Removed hardcoded descriptions
        "grouped_counterfactuals": cf_data['grouped_counterfactuals']
    }
    
    print(f"⏳ Sending {cf_data['total_generated']} counterfactuals across {cf_data['unique_combos']} feature combinations to Gemini...")
    print(f"⏳ Gemini will analyze and select the 5 best diverse options...")
    print(f"✨ Feature descriptions will be auto-fetched from the dataset")
    
    response = make_api_request('POST', f'predictions/{prediction_id}/explain/', json=explain_data)
    
    if response:
        explanation = response['explanation']
        print(f"✅ Explanation Generated:\n")
        print("-" * 50)
        print(explanation)
        print("-" * 50)
        return True
    
    return False


# ============================================================================
#                                  Main Pipeline
# ============================================================================

def run_test() -> None:
    """Run the complete Adult dataset pipeline test."""
    try:
        # Check dependencies and server
        if not check_dependencies():
            return
        
        if not check_server():
            return
        
        # Step 1: Load or fetch dataset
        print_step("1. Create the Adult Dataset")
        df, target_col = load_or_fetch_dataset()
        if df is None:
            return
        
        # Step 2: Upload dataset
        dataset_id = upload_dataset()
        if dataset_id is None:
            return
        
        # Step 3: Process dataset
        print_step("2. Process the dataset")
        if not process_dataset(dataset_id):
            return
        
        # Step 4: Train model
        print_step("3. Train the XGBoost Model")
        model_id = train_model(dataset_id, df, target_col)
        if model_id is None:
            return
        
        # Step 5: Make prediction
        print_step("4. Make a Prediction")
        prediction_result = make_prediction(model_id, df, target_col)
        if prediction_result is None:
            return
        
        # Step 6: Generate counterfactuals
        print_step("5. Generate DiCE Counterfactuals")
        cf_data = generate_counterfactuals(
            prediction_result['prediction_id'],
            prediction_result['predicted_value']
        )
        if cf_data is None:
            return
        
        # Step 7: Generate LLM explanation
        print_step("6. Generate LLM Explanation using Gemini")
        if not generate_explanation(
            prediction_result['prediction_id'],
            cf_data,
            prediction_result['actual_label']
        ):
            return
        
        print("\n🎉 Full Adult dataset pipeline test completed successfully!")
    
    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")


if __name__ == "__main__":
    run_test()
