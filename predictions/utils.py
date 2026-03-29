"""
Utility functions for predictions and counterfactual generation
"""
import numpy as np
import hashlib
import json
from typing import Dict, List, Any, Tuple


def hash_input_data(input_data: Dict) -> str:
    """
    Create hash of input data for caching
    
    Args:
        input_data: Input features dictionary
        
    Returns:
        Hash string
    """
    # Sort keys for consistent hashing
    sorted_data = json.dumps(input_data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()


def calculate_distance(point1: np.ndarray, point2: np.ndarray, method: str = 'l2') -> float:
    """
    Calculate distance between two points
    
    Args:
        point1: First point
        point2: Second point
        method: Distance method ('l2', 'l1', 'cosine')
        
    Returns:
        Distance value
    """
    if method == 'l2':
        return float(np.linalg.norm(point1 - point2))
    elif method == 'l1':
        return float(np.sum(np.abs(point1 - point2)))
    elif method == 'cosine':
        return float(1 - np.dot(point1, point2) / (np.linalg.norm(point1) * np.linalg.norm(point2)))
    else:
        raise ValueError(f"Unsupported distance method: {method}")


def get_feature_changes(original: Dict, counterfactual: Dict) -> Dict:
    """
    Get detailed feature changes between original and counterfactual
    
    Args:
        original: Original feature values
        counterfactual: Counterfactual feature values
        
    Returns:
        Dictionary with change details
    """
    changes = {}
    
    for feature, cf_value in counterfactual.items():
        orig_value = original.get(feature)
        if orig_value != cf_value:
            changes[feature] = {
                'original': orig_value,
                'counterfactual': cf_value,
                'change': cf_value - orig_value if isinstance(cf_value, (int, float)) else None,
                'percent_change': ((cf_value - orig_value) / orig_value * 100) if isinstance(cf_value, (int, float)) and orig_value != 0 else None,
            }
    
    return changes


def calculate_actionability_score(feature_changes: Dict, feature_constraints: Dict = None) -> float:
    """
    Calculate actionability score for counterfactual
    
    Args:
        feature_changes: Dictionary of feature changes
        feature_constraints: Optional constraints on features
        
    Returns:
        Actionability score (0-1)
    """
    # TODO: Implement sophisticated actionability scoring
    # For now, return a simple score based on number of changes
    # Combine number of changes with magnitude of changes
    num_changes = len(feature_changes)
    
    # Base score from number of changes
    score = 1.0 - (num_changes * 0.1)
    
    # Penalize large numeric jumps (magnitudes)
    # Since we don't have global scale, we use a relative penalty
    # This is a heuristic: large absolute values for 'change' reduce scores slightly
    magnitude_penalty = 0.0
    for details in feature_changes.values():
        abs_change = abs(details.get('change', 0) or 0)
        if abs_change > 0:
            # log-scale penalty so it doesn't instantly kill the score
            magnitude_penalty += np.log10(abs_change + 1) * 0.01 
            
    return max(0.01, score - magnitude_penalty)


def prepare_shap_data(shap_values: np.ndarray, feature_names: List[str], base_value: float) -> Dict:
    """
    Prepare SHAP data for storage and visualization
    
    Args:
        shap_values: SHAP values array
        feature_names: List of feature names
        base_value: Base value (expected value)
        
    Returns:
        Dictionary with SHAP data
    """
    # Create feature importance ranking
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
