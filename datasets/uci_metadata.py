"""
UCI Dataset Metadata Extraction
Dynamically fetch metadata from UCI Machine Learning Repository
"""
from typing import Dict, Optional
from ucimlrepo import fetch_ucirepo


# Map of dataset names to UCI repository IDs
UCI_DATASET_IDS = {
    'wine': 109,
    'adult': 2,
    'iris': 53,
    # Add more datasets as needed
}


def fetch_uci_metadata(dataset_id: int) -> Optional[Dict]:
    """
    Fetch metadata from UCI ML Repository using ucimlrepo package
    
    Args:
        dataset_id: UCI dataset ID (e.g., 109 for wine)
        
    Returns:
        Dictionary containing variable metadata or None if failed
    """
    try:
        # Fetch dataset
        dataset = fetch_ucirepo(id=dataset_id)
        
        # Extract variable information
        variables = dataset.variables
        
        # Convert to dictionary format
        metadata = {}
        for _, row in variables.iterrows():
            col_name = row['name']
            metadata[col_name] = {
                'role': row.get('role', '').lower(),  # 'feature' or 'target'
                'type': row.get('type', '').lower(),  # 'categorical', 'continuous', 'integer', etc.
            }
        
        return metadata
        
    except ImportError:
        print("⚠️  ucimlrepo package not installed. Run: pip install ucimlrepo")
        return None
    except Exception as e:
        print(f"⚠️  Error fetching UCI metadata: {str(e)}")
        return None


def get_uci_metadata_for_dataset(dataset_name: str) -> Optional[Dict]:
    """
    Get UCI metadata for a known dataset by name
    
    Args:
        dataset_name: Name of the dataset (e.g., 'wine', 'adult')
        
    Returns:
        Dictionary mapping column names to their metadata
    """
    dataset_name_lower = dataset_name.lower()
    
    # Try exact match first
    if dataset_name_lower in UCI_DATASET_IDS:
        dataset_id = UCI_DATASET_IDS[dataset_name_lower]
        return fetch_uci_metadata(dataset_id)
    
    # Try partial match (e.g., "wine_dataset" matches "wine")
    for known_dataset, dataset_id in UCI_DATASET_IDS.items():
        if known_dataset in dataset_name_lower:
            return fetch_uci_metadata(dataset_id)
    
    return None


def get_column_metadata(dataset_name: str, column_name: str) -> Optional[Dict]:
    """
    Get metadata for a specific column in a UCI dataset
    
    Args:
        dataset_name: Name of the dataset
        column_name: Name of the column
        
    Returns:
        Dictionary with 'role' and 'type' or None if not found
    """
    dataset_metadata = get_uci_metadata_for_dataset(dataset_name)
    
    if dataset_metadata:
        return dataset_metadata.get(column_name)
    
    return None


def is_known_uci_dataset(dataset_name: str) -> bool:
    """Check if this is a known UCI dataset"""
    dataset_name_lower = dataset_name.lower()
    return any(known in dataset_name_lower for known in UCI_DATASET_IDS.keys())


def map_uci_type_to_feature_type(uci_type: str) -> str:
    """
    Map UCI data type to our internal feature type
    
    Args:
        uci_type: UCI type string (e.g., 'Categorical', 'Continuous', 'Integer')
        
    Returns:
        Our internal feature type: 'categorical', 'continuous', 'binary', etc.
    """
    uci_type_lower = uci_type.lower()
    
    if uci_type_lower in ['categorical', 'binary']:
        return 'categorical'
    elif uci_type_lower in ['continuous', 'integer']:
        return 'continuous'
    elif uci_type_lower == 'datetime':
        return 'datetime'
    elif uci_type_lower == 'text':
        return 'text'
    else:
        return uci_type_lower if uci_type_lower else 'unknown'
