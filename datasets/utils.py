"""
Utility functions for dataset processing
"""
import os
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
import google.generativeai as genai


def detect_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """
    Detect granular feature types: binary, categorical, continuous, datetime, text
    
    Args:
        df: pandas DataFrame
        
    Returns:
        Dictionary mapping column names to their feature types
    """
    feature_types = {}
    
    for col in df.columns:
        num_unique = df[col].nunique()
        
        # DateTime detection
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            feature_types[col] = 'datetime'
        
        # Numeric columns (includes bool, int, float, Int64, etc.)
        elif pd.api.types.is_numeric_dtype(df[col]):
            # If numeric but has very few unique values, it's categorical
            if num_unique <= 20:
                feature_types[col] = 'categorical'
            else:
                feature_types[col] = 'continuous'
        
        # Pandas categorical dtype (when explicitly converted)
        elif isinstance(df[col].dtype, pd.CategoricalDtype):
            feature_types[col] = 'categorical'
        
        # Object/String columns (includes 'object' and 'string' dtypes)
        elif df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
            # Check if it's categorical or text
            if num_unique <= 50:
                feature_types[col] = 'categorical'
            else:
                feature_types[col] = 'text'
        
        else:
            # Rare edge cases: period, sparse, etc.
            feature_types[col] = 'unknown'
    
    return feature_types


def calculate_column_statistics(df: pd.DataFrame, col: str, feature_type: str = None) -> Dict:
    """
    Calculate statistics for a column
    
    Args:
        df: pandas DataFrame
        col: column name
        feature_type: Type of feature ('binary', 'categorical', 'continuous', etc.)
        
    Returns:
        Dictionary with column statistics
    """
    stats = {
        'missing_count': int(df[col].isna().sum()),
        'missing_percentage': float(df[col].isna().sum() / len(df) * 100),
    }
    
    # Numeric statistics for continuous/numeric columns
    if pd.api.types.is_numeric_dtype(df[col]):
        stats.update({
            'min_value': float(df[col].min()) if not df[col].isna().all() else None,
            'max_value': float(df[col].max()) if not df[col].isna().all() else None,
            'mean_value': float(df[col].mean()) if not df[col].isna().all() else None,
            'std_value': float(df[col].std()) if not df[col].isna().all() else None,
        })
    
    # Collect unique values for categorical, binary, and object columns
    # This is crucial for dropdown menus in the frontend
    should_collect_unique = (
        feature_type in ['categorical'] or
        df[col].dtype == 'object' or 
        pd.api.types.is_categorical_dtype(df[col])
    )
    
    if should_collect_unique:
        unique_vals = df[col].dropna().unique()
        
        # Convert numpy types to native Python types for JSON serialization
        unique_values_list = []
        for val in unique_vals:
            if pd.isna(val):
                continue
            # Convert numpy types to Python types
            if isinstance(val, (np.integer, np.floating)):
                unique_values_list.append(float(val) if isinstance(val, np.floating) else int(val))
            else:
                unique_values_list.append(str(val))
        
        # Sort for consistent ordering in dropdowns
        try:
            unique_values_list = sorted(unique_values_list)
        except TypeError:
            # If mixed types, keep original order
            pass
        
        stats.update({
            'unique_values': unique_values_list[:200],  # Increased limit for dropdowns
            'num_unique': int(df[col].nunique()),
        })
    
    return stats


def load_clean_dataset(file_path: str) -> pd.DataFrame:
    """Load dataset safely and drop NAs"""
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format")
    return df.dropna()

def process_dataset_file(file_path: str) -> Tuple[pd.DataFrame, Dict]:
    """
    Process uploaded dataset file by reading it, removing missing values,
    saving the clean dataset, and extracting metadata.
    
    Args:
        file_path: Path to the dataset file
        
    Returns:
        Tuple of (DataFrame, metadata dictionary)
    """
    df = load_clean_dataset(file_path)
    
    # Save cleaned df back to file
    if file_path.endswith('.csv'):
        df.to_csv(file_path, index=False)
    elif file_path.endswith(('.xls', '.xlsx')):
        df.to_excel(file_path, index=False)
    
    # Extract metadata
    metadata = {
        'num_rows': len(df),
        'num_columns': len(df.columns),
        'column_names': df.columns.tolist(),
        'column_types': detect_column_types(df),
    }
    
    return df, metadata


def generate_feature_descriptions(
    df: pd.DataFrame,
    column_names: List[str],
    column_types: Dict[str, str],
    dataset_name: str = "the dataset"
) -> Dict[str, str]:
    """
    Use LLM to generate human-readable descriptions for each feature.
    
    Args:
        df: pandas DataFrame with the dataset
        column_names: List of column names
        column_types: Dictionary mapping column names to types
        dataset_name: Name of the dataset for context
        
    Returns:
        Dictionary mapping feature names to their descriptions
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    
    # If no API key, return empty descriptions
    if not api_key:
        print("GEMINI_API_KEY not set. Skipping feature description generation.")
        return {col: "" for col in column_names}
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3.1-flash-lite-preview')
    
    # Build feature info for the prompt
    feature_info = []
    for col in column_names:
        col_type = column_types.get(col, 'unknown')
        info = f"- **{col}** (type: {col_type})"
        
        # Add sample values or statistics
        if col_type == 'continuous':
            min_val = df[col].min()
            max_val = df[col].max()
            mean_val = df[col].mean()
            info += f" - Range: {min_val:.2f} to {max_val:.2f}, Mean: {mean_val:.2f}"
        elif col_type == 'categorical':
            unique_vals = df[col].unique()[:5]  # First 5 unique values
            info += f" - Example values: {', '.join(map(str, unique_vals))}"
        
        feature_info.append(info)
    
    feature_info_str = "\n".join(feature_info)
    
    # Create prompt for LLM
    prompt = f"""You are analyzing a dataset called "{dataset_name}". Below are the features (columns) in this dataset:

{feature_info_str}

TASK:
For each feature, provide a concise, human-readable description (5-15 words) that explains what the feature represents in plain English. Keep descriptions practical and easy to understand for non-technical users.

Format your response as a JSON object where keys are feature names and values are descriptions.
Example format:
{{
    "feature1": "brief description of feature1",
    "feature2": "brief description of feature2"
}}

Return ONLY the JSON object, no additional text."""
    
    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Extract JSON from response (might be wrapped in markdown code blocks)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        # Parse JSON
        import json
        descriptions = json.loads(response_text)
        
        # Ensure all columns have a description (use empty string if missing)
        return {col: descriptions.get(col, "") for col in column_names}
    
    except Exception as e:
        print(f"Error generating feature descriptions: {str(e)}")
        # Return empty descriptions on error
        return {col: "" for col in column_names}
