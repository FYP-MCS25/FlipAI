import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_step(step_name):
    print(f"\n{'='*50}")
    print(f"STEP: {step_name}")
    print(f"{'='*50}")

def run_test():
    try:
        # 1. Check if server is up
        try:
            requests.get("http://127.0.0.1:8000/")
        except requests.exceptions.ConnectionError:
            print("❌ ERROR: Django server is not running!")
            print("Please run 'python manage.py runserver' in another terminal first.")
            return

        print_step("1. Create the Adult Dataset")
        try:
            from ucimlrepo import fetch_ucirepo 
            import pandas as pd
        except ImportError:
            print("❌ Missing dependency. Please run: pip install ucimlrepo pandas")
            return
            
        print("Fetching dataset from UCI...")
        adult = fetch_ucirepo(id=2) 
        X = adult.data.features 
        y = adult.data.targets 
        
        # Combine and take a subset if we want faster testing, but we can do full 32k rows 
        df = pd.concat([X, y], axis=1)
        
        # Ensure we drop NaNs so training is straightforward
        df = df.dropna()
        
        # Also fix the weird income column (UCI Adult has <=50K and >50K but some have dots)
        target_col = y.columns[0]
        df[target_col] = df[target_col].astype(str).str.replace('.', '', regex=False)
        
        # XGBoost requires target classes to be numeric (0, 1) rather than string labels
        df[target_col] = df[target_col].map({'<=50K': 0, '>50K': 1})
        
        # Ensure mapping didn't introduce NaNs (in case there were other weird values)
        df = df.dropna()
        
        # Save to CSV
        csv_filename = "adult_data.csv"
        df.to_csv(csv_filename, index=False)
            
        # Upload dataset
        print("Uploading to Django API...")
        with open(csv_filename, 'rb') as f:
            files = {'file': (csv_filename, f, 'text/csv')}
            data = {'name': 'Adult Dataset Subset', 'description': 'UCI Adult Income Dataset (2000 rows)'}
            response = requests.post(f"{BASE_URL}/datasets/", files=files, data=data)
            
        if response.status_code != 201:
            print(f"❌ Failed to upload dataset: {response.text}")
            return
            
        dataset_id = response.json()['id']
        print(f"✅ Dataset uploaded successfully! ID: {dataset_id}")

        print_step("2. Process the dataset")
        response = requests.post(f"{BASE_URL}/datasets/{dataset_id}/process/")
        if response.status_code != 200:
            print(f"❌ Failed to process dataset: {response.text}")
            return
        print(f"✅ Dataset processed! Metadata found: {response.json().get('metadata', {}).get('num_rows')} rows")

        print_step("3. Train the XGBoost Model")
        # Ensure we only use columns that survived dropping NaNs
        feature_cols = [c for c in X.columns if c in df.columns]
        
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
        response = requests.post(f"{BASE_URL}/models/train/", json=train_data)
        if response.status_code != 200:
            print(f"❌ Failed to train model: {response.text}")
            return
            
        model_id = response.json()['model_id']
        metrics = response.json()['metrics']
        print(f"✅ Model trained successfully! ID: {model_id}")
        print(f"📊 Training Accuracy: {metrics.get('train_accuracy')}")
        print(f"📊 Test Accuracy: {metrics.get('test_accuracy')}")

        print_step("4. Make a Prediction")
        
        # Pick someone who makes <=50K (mapped to 0) as our test subject
        low_income_subject = df[df[target_col] == 0].iloc[0]
        actual_income = "<=50K"
        
        sample_person = low_income_subject.drop(target_col).to_dict()
        
        predict_data = {
            "model_id": model_id,
            "input_data": sample_person,
            "generate_shap": True
        }
        
        print("Making prediction for the following profile:")
        print(json.dumps(sample_person, indent=2))
        
        response = requests.post(f"{BASE_URL}/predictions/predict/", json=predict_data)
        if response.status_code != 200:
            print(f"❌ Failed to make prediction: {response.text}")
            return
            
        prediction_id = response.json()['prediction_id']
        pred_value = response.json().get('prediction_class', response.json().get('prediction_value'))
        
        # Calculate confidence if capabilities permit
        probs = response.json().get('prediction_probabilities')
        conf_str = ""
        if probs and str(pred_value) in probs:
            conf_str = f"[Confidence: {float(probs[str(pred_value)])*100:.1f}%]"
            
        print(f"✅ Prediction made successfully! {conf_str} ID: {prediction_id}")
        print(f"🔮 Predicted Value: {pred_value} (Actual: {actual_income})")
        
        shap_data = response.json().get('shap_explanation', {})
        if shap_data:
            print(f"📈 Top SHAP Feature Impacts:")
            for feature in shap_data.get('feature_importance', [])[:3]:
                print(f"   - {feature['feature']}: {feature['shap_value']:.4f}")

        print_step("5. Generate DiCE Counterfactuals")
        # We mapped <=50K to 0, and >50K to 1. If predicted 0, we want 1.
        desired_class = 1 if int(float(pred_value)) == 0 else 0
        desired_label = ">50K" if desired_class == 1 else "<=50K"
        
        cf_data = {
            "prediction_id": prediction_id,
            "desired_class": desired_class,
            "max_iterations": 10,
            "feature_constraints": {
                # Freeze features the user cannot realistically change
                "frozen_features": ["age", "sex", "race", "native-country"]
            }
        }
        
        print(f"Finding counterfactuals to achieve: {desired_label} (Class {desired_class})")
        response = requests.post(f"{BASE_URL}/predictions/{prediction_id}/find_counterfactuals/", json=cf_data)
        if response.status_code != 200:
            print(f"❌ Failed to generate counterfactuals: {response.text}")
            return
            
        cfs = response.json().get('counterfactuals', [])
        print(f"✅ Found {len(cfs)} counterfactuals!")
        if cfs:
            for i, cf in enumerate(cfs):
                conf = cf.get('confidence')
                conf_str = f" [Confidence: {conf*100:.1f}%]" if conf is not None else ""
                changes = cf.get('feature_changes', {})
                changes_str = ", ".join([f"{k}: {v['original']} -> {v['counterfactual']}" for k, v in changes.items()])
                print(f"  Option {i+1}{conf_str}: {changes_str}")

        print_step("6. Generate LLM Explanation using Gemini")
        explain_data = {
            "expected_outcome": desired_class,
            "expected_outcome_label": desired_label,
            "predicted_outcome_label": actual_income,
            "target_description": "annual income of more than $50,000" if desired_class == 1 else "annual income of $50,000 or less",
            "feature_descriptions": {
                "capital-gain": "yearly profits from investments or asset sales",
                "capital-loss": "yearly losses from investments or asset sales",
                "education-num": "years of formal education",
                "hours-per-week": "number of hours worked each week"
            }
        }
        
        print(f"⏳ Waiting for Gemini API to explain how to get {desired_label}...")
        response = requests.post(f"{BASE_URL}/predictions/{prediction_id}/explain/", json=explain_data)
        if response.status_code != 200:
            print(f"❌ Failed to explain prediction: {response.text}")
            return
            
        explanation = response.json()['explanation']
        print(f"✅ Explanation Generated:\n")
        print("-" * 50)
        print(explanation)
        print("-" * 50)

        print("\n🎉 Full Adult dataset pipeline test completed successfully!")

    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")

if __name__ == "__main__":
    run_test()
