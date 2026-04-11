"""
Utility functions for predictions and counterfactual generation.

This module provides helper functions for:
- Input data hashing and caching
- Distance calculations between data points
- Feature change analysis
- Actionability scoring for counterfactuals
- SHAP value preparation
- Counterfactual grouping and selection
"""
import hashlib
import json
from typing import Dict, List, Any

import numpy as np


# ============================================================================
#                           Data Hashing and Caching
# ============================================================================

def hash_input_data(input_data: Dict) -> str:
    """
    Create cryptographic hash of input data for caching.
    
    Args:
        input_data: Dictionary of input features
        
    Returns:
        SHA-256 hash string
    """
    sorted_data = json.dumps(input_data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()


# ============================================================================
#                              Distance Calculations
# ============================================================================

def calculate_distance(point1: np.ndarray, point2: np.ndarray, method: str = 'l2') -> float:
    """
    Calculate distance between two points using various metrics.
    
    Args:
        point1: First point as numpy array
        point2: Second point as numpy array
        method: Distance metric ('l2', 'l1', or 'cosine')
        
    Returns:
        Distance value as float
        
    Raises:
        ValueError: If unsupported distance method is specified
    """
    if method == 'l2':
        return float(np.linalg.norm(point1 - point2))
    elif method == 'l1':
        return float(np.sum(np.abs(point1 - point2)))
    elif method == 'cosine':
        return float(1 - np.dot(point1, point2) / (np.linalg.norm(point1) * np.linalg.norm(point2)))
    else:
        raise ValueError(f"Unsupported distance method: {method}")


# ============================================================================
#                           Feature Change Analysis
# ============================================================================

def get_feature_changes(original: Dict, counterfactual: Dict) -> Dict:
    """
    Get detailed feature changes between original and counterfactual inputs.
    
    Calculates both absolute and percentage changes for numeric features.
    
    Args:
        original: Original feature values
        counterfactual: Counterfactual feature values
        
    Returns:
        Dictionary mapping changed features to their change details:
        {
            'feature_name': {
                'original': value,
                'counterfactual': value,
                'change': absolute_change (numeric only),
                'percent_change': percentage_change (numeric only)
            }
        }
    """
    changes = {}
    
    for feature, cf_value in counterfactual.items():
        orig_value = original.get(feature)
        if orig_value != cf_value:
            change_info = {
                'original': orig_value,
                'counterfactual': cf_value,
                'change': None,
                'percent_change': None
            }
            
            # Calculate numeric changes
            if isinstance(cf_value, (int, float)) and isinstance(orig_value, (int, float)):
                change_info['change'] = cf_value - orig_value
                if orig_value != 0:
                    change_info['percent_change'] = (cf_value - orig_value) / orig_value * 100
            
            changes[feature] = change_info
    
    return changes


# ============================================================================
#                           Actionability Scoring
# ============================================================================

def calculate_actionability_score(
    feature_changes: Dict,
    feature_constraints: Dict = None
) -> float:
    """
    Calculate actionability score for a counterfactual.
    
    Scores are based on number of changes and magnitude of numeric changes.
    Lower scores indicate less actionable (many or large changes).
    
    Args:
        feature_changes: Dictionary of feature changes from get_feature_changes()
        feature_constraints: Optional constraints on features (not currently used)
        
    Returns:
        Actionability score between 0.01 and 1.0 (higher is more actionable)
    """
    num_changes = len(feature_changes)
    
    # Base score penalizes number of changes
    score = 1.0 - (num_changes * 0.1)
    
    # Additional penalty for large numeric changes
    magnitude_penalty = 0.0
    for details in feature_changes.values():
        abs_change = abs(details.get('change', 0) or 0)
        if abs_change > 0:
            # Log-scale penalty to avoid overly harsh penalization
            magnitude_penalty += np.log10(abs_change + 1) * 0.01
    
    return max(0.01, score - magnitude_penalty)


# ============================================================================
#                           SHAP Value Preparation
# ============================================================================

def prepare_shap_data(shap_values: np.ndarray, feature_names: List[str], base_value: float) -> Dict:
    """
    Prepare SHAP values for storage and visualization.
    
    Creates a ranked list of feature importances based on absolute SHAP values.
    
    Args:
        shap_values: SHAP values array for a single prediction
        feature_names: List of feature names corresponding to SHAP values
        base_value: Expected value (baseline prediction)
        
    Returns:
        Dictionary containing:
        - shap_values: Mapping of feature names to SHAP values
        - feature_importance: Ranked list of features by importance
        - base_value: Base value for the model
    """
    abs_shap = np.abs(shap_values)
    indices = np.argsort(abs_shap)[::-1]
    
    feature_importance = [
        {
            'feature': feature_names[i],
            'shap_value': float(shap_values[i]),
            'abs_shap_value': float(abs_shap[i]),
            'rank': rank + 1,
        }
        for rank, i in enumerate(indices)
    ]
    
    return {
        'shap_values': {name: float(val) for name, val in zip(feature_names, shap_values)},
        'feature_importance': feature_importance,
        'base_value': float(base_value),
    }


# ============================================================================
#                   Counterfactual Grouping and Selection
# ============================================================================

def get_feature_combination_key(changed_features: List[str]) -> str:
    """
    Generate a unique key for a feature combination.
    
    Args:
        changed_features: List of feature names that changed
        
    Returns:
        Sorted, comma-separated string of feature names
    """
    return ','.join(sorted(changed_features))


def calculate_combined_score(
    feature_changes: Dict,
    confidence: float,
    original_input: Dict
) -> float:
    """
    Calculate combined score based on change ratios and model confidence.
    
    Balances actionability (minimal changes) with reliability (high confidence).
    Uses 70% weight for change minimization, 30% for confidence.
    
    Args:
        feature_changes: Dictionary of feature changes
        confidence: Model confidence for this counterfactual (0-1)
        original_input: Original input values for ratio calculation
        
    Returns:
        Combined score (0-1, higher is better)
    """
    if not feature_changes:
        return confidence
    
    # Calculate average change ratio
    ratios = []
    for feature, details in feature_changes.items():
        original = details.get('original', 0)
        cf_value = details.get('counterfactual', 0)
        
        # Handle numeric features
        if isinstance(original, (int, float)) and isinstance(cf_value, (int, float)):
            if original != 0:
                ratio = abs((cf_value - original) / original)
            else:
                ratio = abs(cf_value)
            ratios.append(ratio)
        else:
            # Categorical change - penalize equally
            ratios.append(1.0)
    
    if ratios:
        avg_ratio = sum(ratios) / len(ratios)
        # Exponential decay heavily favors smaller changes
        change_score = np.exp(-avg_ratio)
    else:
        change_score = 1.0
    
    # Combine: 70% change minimization, 30% confidence
    combined = (change_score * 0.7) + (confidence * 0.3)
    
    return float(combined)


def group_counterfactuals_by_features(counterfactuals: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Group counterfactuals by their feature combination.
    
    Args:
        counterfactuals: List of counterfactual dictionaries with 'changed_features' key
        
    Returns:
        Dictionary mapping feature combination keys to lists of counterfactuals
    """
    grouped = {}
    
    for cf in counterfactuals:
        changed_features = cf.get('changed_features', [])
        key = get_feature_combination_key(changed_features)
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(cf)
    
    return grouped


def select_top_counterfactuals_by_diversity(
    counterfactuals: List[Dict],
    original_input: Dict,
    top_n: int = 5
) -> List[Dict]:
    """
    Select top N counterfactuals ensuring diversity of feature combinations.
    
    For each unique feature combination, selects the best counterfactual
    based on combined score (change minimization + confidence), then returns
    the top N across all groups.
    
    Args:
        counterfactuals: List of counterfactual dictionaries
        original_input: Original input for scoring calculation
        top_n: Number of counterfactuals to return
        
    Returns:
        List of top N counterfactuals (best from each feature combination)
    """
    if not counterfactuals:
        return []
    
    # Group by feature combinations
    grouped = group_counterfactuals_by_features(counterfactuals)
    
    # Select best from each group
    best_from_each_group = []
    
    for feature_combo, cf_list in grouped.items():
        # Calculate combined score for each CF in this group
        scored_cfs = []
        for cf in cf_list:
            score = calculate_combined_score(
                cf.get('feature_changes', {}),
                cf.get('confidence', 0.5),
                original_input
            )
            scored_cfs.append((score, cf))
        
        # Get best from this group
        scored_cfs.sort(key=lambda x: x[0], reverse=True)
        best_cf = scored_cfs[0][1]
        best_cf['_combined_score'] = scored_cfs[0][0]
        best_cf['_feature_combo'] = feature_combo
        best_from_each_group.append(best_cf)
    
    # Sort all groups by their best score
    best_from_each_group.sort(key=lambda x: x['_combined_score'], reverse=True)
    
    # Return top N
    return best_from_each_group[:top_n]
