"""
Utility functions for dataset processing
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple


def detect_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """
    Detect column types (numeric, categorical, datetime, text)
    
    Args:
        df: pandas DataFrame
        
    Returns:
        Dictionary mapping column names to their types
    """
    column_types = {}
    
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            column_types[col] = 'numeric'
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            column_types[col] = 'datetime'
        elif df[col].dtype == 'object':
            # Check if it's categorical or text
            unique_ratio = df[col].nunique() / len(df)
            if unique_ratio < 0.05:  # Less than 5% unique values
                column_types[col] = 'categorical'
            else:
                column_types[col] = 'text'
        else:
            column_types[col] = 'unknown'
    
    return column_types


def calculate_column_statistics(df: pd.DataFrame, col: str) -> Dict:
    """
    Calculate statistics for a column
    
    Args:
        df: pandas DataFrame
        col: column name
        
    Returns:
        Dictionary with column statistics
    """
    stats = {
        'missing_count': int(df[col].isna().sum()),
        'missing_percentage': float(df[col].isna().sum() / len(df) * 100),
    }
    
    if pd.api.types.is_numeric_dtype(df[col]):
        stats.update({
            'min_value': float(df[col].min()) if not df[col].isna().all() else None,
            'max_value': float(df[col].max()) if not df[col].isna().all() else None,
            'mean_value': float(df[col].mean()) if not df[col].isna().all() else None,
            'std_value': float(df[col].std()) if not df[col].isna().all() else None,
        })
    
    if df[col].dtype == 'object' or pd.api.types.is_categorical_dtype(df[col]):
        unique_values = df[col].dropna().unique().tolist()
        stats.update({
            'unique_values': unique_values[:100],  # Limit to 100 values
            'num_unique': int(df[col].nunique()),
        })
    
    return stats


def process_dataset_file(file_path: str) -> Tuple[pd.DataFrame, Dict]:
    """
    Process uploaded dataset file by reading it, removing missing values,
    saving the clean dataset, and extracting metadata.
    
    Args:
        file_path: Path to the dataset file
        
    Returns:
        Tuple of (DataFrame, metadata dictionary)
    """
    # Read file based on extension
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format")
    
    # Drop rows with any missing values
    df = df.dropna()
    
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
