import os
import pandas as pd

dataset_name = "adult"

# Get the folder where this script is located
BASE_DIR = os.path.dirname(__file__)  # folder containing this script

# Build paths relative to the script
NAMES_FILE = os.path.join(BASE_DIR, "data_files", dataset_name, f"{dataset_name}.names")
DATA_FILE = os.path.join(BASE_DIR, "data_files", dataset_name, f"{dataset_name}.data")
OUTPUT_DIR = os.path.join(BASE_DIR, "csv")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, f"{dataset_name}.csv")

def extract_headers(names_file: str) -> list:
    """
    Extract column names from .names file.
    """
    column_names = []
    with open(names_file, "r") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("|"):
                continue
            # Label/target line
            if line.startswith(">") or line.startswith("<"):
                target_column = "income"  # rename target column
                continue
            # Extract column name before the colon
            if ":" in line:
                col_name = line.split(":")[0].strip()
                column_names.append(col_name)
    # Add target column at the end
    column_names.append(target_column)
    return column_names

def load_data(data_file: str, headers: list) -> pd.DataFrame:
    """
    Load .data file with extracted headers.
    Treat ' ?' as missing values.
    """
    df = pd.read_csv(data_file, header=None, names=headers, na_values=" ?", skipinitialspace=True)
    return df

def convert_to_csv(df: pd.DataFrame, output_file: str):
    """
    Save DataFrame as CSV.
    """
    output_dir = os.path.dirname(output_file)
    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"✅ CSV saved to {output_file}")

if __name__ == "__main__":
    headers = extract_headers(NAMES_FILE)
    print("Extracted headers:", headers)
    
    df = load_data(DATA_FILE, headers)
    print("Loaded data shape:", df.shape)
    
    convert_to_csv(df, OUTPUT_CSV)