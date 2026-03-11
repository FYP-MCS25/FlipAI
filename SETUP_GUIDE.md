# FlipAI Complete Setup Guide

**Last Updated:** March 11, 2026  
**Python Version:** 3.12 (recommended)  
**Django Version:** 5.0

This comprehensive guide covers the complete setup process for the FlipAI development environment, including all installations and configurations that were performed.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Python Installation](#python-installation)
3. [PostgreSQL Installation](#postgresql-installation)
4. [Project Setup](#project-setup)
5. [Database Configuration](#database-configuration)
6. [Running the Application](#running-the-application)
7. [ML Pipeline — Training & Counterfactuals](#ml-pipeline--training--counterfactuals)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

- **Operating System:** macOS or Windows 10/11
- **Python:** 3.10+ (**3.12 recommended** — see [Python 3.13 note](#issue-8-shap--numba-incompatibility-with-python-313))
- **PostgreSQL:** 14+
- **Package Manager:** 
  - macOS: Homebrew
  - Windows: Chocolatey (optional) or manual installers
- **RAM:** 8GB minimum, 16GB recommended
- **Disk Space:** 5GB minimum for dependencies and environments

> ⚠️ **Why Python 3.12?** SHAP depends on `numba`, which has compatibility issues with Python 3.13. Python 3.12 is the most stable choice for the full ML stack (SHAP + DiCE + XGBoost).

---

## Python Installation

### Check Current Python Version

**macOS/Linux:**
```bash
python3 --version
```

**Windows (Command Prompt or PowerShell):**
```cmd
python --version
```

### Install Python 3.12 (Recommended)

#### macOS

If your Python version is below 3.10, or you have 3.13 (which has ML library issues), install 3.12:

```bash
# Install Python 3.12
brew install python@3.12

# Verify installation
python3.12 --version
```

**Alternative: Using pyenv (Recommended for macOS)**

pyenv allows you to manage multiple Python versions easily:

```bash
# Install pyenv
brew install pyenv

# Install Python 3.12
pyenv install 3.12.3

# Set as local version for this project
cd /path/to/FlipAI
pyenv local 3.12.3

# Verify
python --version  # Should show 3.12.3
```

#### Windows

1. Download **Python 3.12** from https://www.python.org/downloads/release/python-3123/
2. Run the installer
3. ✅ **IMPORTANT:** Check "Add Python to PATH" during installation
4. Click "Install Now"
5. Verify installation:
   ```cmd
   python --version
   ```

**Note:** Python comes with pip pre-installed, so you'll have everything you need after this installation.

---

## PostgreSQL Installation

### Install PostgreSQL 15

#### macOS

```bash
# Install PostgreSQL
brew install postgresql@15
```

**Configure PostgreSQL PATH:**

```bash
# Add to ~/.zshrc
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc

# Reload shell configuration
source ~/.zshrc
```

**Start PostgreSQL Service:**

```bash
# Start PostgreSQL and set it to start on boot
brew services start postgresql@15

# Verify it's running
brew services list | grep postgresql
```

#### Windows

**Option 1: Official Installer (Recommended)**

1. Download PostgreSQL 15 from https://www.postgresql.org/download/windows/
2. Run the installer (EDB installer)
3. During installation:
   - Choose installation directory (default: `C:\Program Files\PostgreSQL\15`)
   - Set a password for the `postgres` user (remember this!)
   - Port: 5432 (default)
   - Locale: Default
4. ✅ **IMPORTANT:** Check "Add to PATH" or manually add to PATH:
   - Add `C:\Program Files\PostgreSQL\15\bin` to system PATH
5. PostgreSQL will start automatically as a Windows service

**Verify Installation:**

```cmd
psql --version
```

### Create Database

#### macOS

```bash
# Create the flipai_db database
createdb flipai_db

# Verify database was created
psql -l | grep flipai_db
```

#### Windows

**Using Command Prompt:**

```cmd
# Create database using psql
psql -U postgres -c "CREATE DATABASE flipai_db;"

# Or connect to psql and create:
psql -U postgres
CREATE DATABASE flipai_db;
\q
```

---

## Project Setup

### 1. Navigate to Project Directory

**macOS/Linux:**
```bash
cd /path/to/FlipAI
```

**Windows:**
```cmd
cd C:\path\to\FlipAI
```

### 2. Create Virtual Environment

**macOS/Linux:**
```bash
# Create virtual environment with Python 3.12
python3.12 -m venv venv

# Or if Python 3.12 is your default:
python3 -m venv venv
```

**Windows:**
```cmd
# Create virtual environment
python -m venv venv
```

### 3. Activate Virtual Environment

**macOS/Linux:**
```bash
source venv/bin/activate

# Your prompt should now show (venv) prefix
```

**Windows:**
```cmd
.venv\Scripts\activate

# Your prompt should now show (venv) prefix

# If you get an execution policy error, run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try activating again
```

### 4. Upgrade pip

```bash
pip install --upgrade pip
```

### 5. Install Required System Packages

Some Python packages require setuptools:

```bash
pip install setuptools
```

### 6. Install Project Dependencies

```bash
# Install all dependencies from requirements.txt
pip install -r requirements.txt
```

**Note:** This will install:
- Django 5.0
- Django REST Framework
- PostgreSQL adapter (psycopg2-binary)
- ML libraries (NumPy, Pandas, scikit-learn, XGBoost, LightGBM)
- SHAP for explainability (with numba for fast TreeSHAP)
- DiCE-ML for counterfactual explanations
- Matplotlib for visualisation
- API documentation tools (drf-yasg)
- Testing tools (pytest, pytest-django, coverage)
- Code quality tools (black, flake8)

**Installation may take 5-10 minutes** depending on your internet connection.

---

## Database Configuration

### 1. Configure Environment Variables

Create your `.env` file from the example:

**macOS/Linux:**
```bash
cp .env.example .env
```

**Windows:**
```cmd
copy .env.example .env
```

### 2. Update Database Credentials

Edit the `.env` file with your database configuration:

**macOS/Linux:**
```bash
# Open in your preferred editor
nano .env
# or
code .env
```

**Windows:**
```cmd
# Open in Notepad
notepad .env
# or
code .env
```

**Configuration:**

```env
# Django Settings
SECRET_KEY=your-secret-key-here-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DB_NAME=flipai_db
DB_USER=your_username  # See instructions below
DB_PASSWORD=           # See instructions below
DB_HOST=localhost
DB_PORT=5432

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# File Upload Settings
MAX_UPLOAD_SIZE=52428800

# Model Storage
MODEL_STORAGE_PATH=models/saved_models/
```

**Database User Configuration:**

**macOS:**
```bash
# Find your username
whoami
# Use this as DB_USER, leave DB_PASSWORD empty
```

**Windows:**
```cmd
# Use 'postgres' as DB_USER
DB_USER=postgres
# Use the password you set during PostgreSQL installation
DB_PASSWORD=your_postgres_password
```

### 3. Create Database Migrations

**macOS/Linux:**
```bash
python3 manage.py makemigrations
```

**Windows:**
```cmd
python manage.py makemigrations
```

**Expected output:**
```
Migrations for 'datasets':
  datasets/migrations/0001_initial.py
Migrations for 'models':
  models/migrations/0001_initial.py
Migrations for 'predictions':
  predictions/migrations/0001_initial.py
```

### 4. Apply Migrations

**macOS/Linux:**
```bash
python3 manage.py migrate
```

**Windows:**
```cmd
python manage.py migrate
```

**Expected output:**
```
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, datasets, models, predictions, sessions
Running migrations:
  Applying contenttypes.0001_initial... OK
  ... (more lines)
  Applying predictions.0001_initial... OK
```

### 5. Create Superuser Account

**macOS/Linux:**
```bash
python3 manage.py createsuperuser
```

**Windows:**
```cmd
python manage.py createsuperuser
```

**Follow prompts:**
```
Username: (your choice)
Email: your_email@example.com
Password: (your choice)
Password (again): (confirm)
```

---

## Running the Application

### Start Development Server

**macOS/Linux:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # if not already activated

# Start server
python3 manage.py runserver
```

**Windows (Command Prompt):**
```cmd
# Make sure virtual environment is activated
venv\Scripts\activate.bat  # if not already activated

# Start server
python manage.py runserver
```

**Windows (PowerShell):**
```powershell
# Make sure virtual environment is activated
venv\Scripts\Activate.ps1  # if not already activated

# Start server
python manage.py runserver
```

**Expected Output:**

```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
December 23, 2025 - 08:54:00
Django version 5.0, using settings 'flipai.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### Access the Application

Open your browser and visit:

1. **Home Page:** http://localhost:8000/
   - Beautiful welcome page with links to all resources

2. **Admin Panel:** http://localhost:8000/admin/
   - Login with your superuser credentials
   - Manage datasets, models, predictions

3. **API Documentation (Swagger):** http://localhost:8000/swagger/
   - Interactive API documentation
   - Test endpoints directly from browser

4. **API Documentation (ReDoc):** http://localhost:8000/redoc/
   - Alternative clean API documentation

5. **API Root:** http://localhost:8000/api/v1/
   - Browse available API endpoints

---

## ML Pipeline — Training & Counterfactuals

FlipAI includes a complete SHAP-integrated training pipeline and DiCE counterfactual generator.

### Train the SHAP-Guided Model

The training script uses iterative SHAP-weighted sample reweighting on the Adult Census dataset:

**macOS/Linux:**
```bash
source venv/bin/activate
python train_shap_adult.py
```

**Windows:**
```cmd
venv\Scripts\activate.bat
python train_shap_adult.py
```

**What it does:**
1. Loads the Adult Census dataset from `datasets/adult/`
2. Preprocesses data (imputation, encoding, scaling)
3. Runs 5 rounds of SHAP-integrated training:
   - Train XGBoost model
   - Compute SHAP values (TreeSHAP)
   - Calculate per-sample difficulty/alignment scores
   - Reweight samples for next round (harder samples get more weight)
4. Saves model and artifacts to `models/saved_models/`
5. Generates SHAP explanation plots (summary, beeswarm, round history)

**Expected output:**
```
  Round 1/5  accuracy = 0.8710
  Round 2/5  accuracy = 0.8723
  ...
  Round 5/5  accuracy = 0.8735

  Final Test Accuracy: 0.8735
```

**Saved files:**
| File | Location | Purpose |
|------|----------|---------|
| `xgboost_adult.json` | `models/saved_models/` | Trained XGBoost model |
| `preprocessing_artifacts.joblib` | `models/saved_models/` | Encoders, scaler, imputation values |
| `shap_summary.png` | `models/saved_models/` | SHAP feature importance bar plot |
| `shap_beeswarm.png` | `models/saved_models/` | SHAP beeswarm plot |
| `shap_training_rounds.png` | `models/saved_models/` | Accuracy across training rounds |
| `shap_values_sample.csv` | `models/saved_models/` | Sample SHAP values |

### Generate Counterfactual Explanations (DiCE)

After training, use DiCE-ML to generate counterfactual explanations that show **what changes would flip a prediction**:

```bash
# Random test sample (default: 4 counterfactuals)
python generate_counterfactuals.py

# Specific test sample by index
python generate_counterfactuals.py --index 42

# Custom interactive input
python generate_counterfactuals.py --custom

# Control number of counterfactuals
python generate_counterfactuals.py --num-cf 5
```

**Example output:**
```
  ORIGINAL INPUT
    age: 36, workclass: Private, education: HS-grad, ...
  Prediction:   <=50K (87.6% confidence)

  DiCE COUNTERFACTUALS (flipping prediction to >50K)

  Counterfactual #1:
    Changes needed (1 feature):
      capital_gain  0 → 28,923
    New prediction: >50K (99.4% confidence)
```

Each counterfactual answers: *"What minimal changes would flip this person's predicted income?"*

---

## Troubleshooting

### Issue 1: PostgreSQL Role Does Not Exist

**Error:**
```
psycopg2.OperationalError: FATAL: role "postgres" does not exist
```

**Solution (macOS):**
Update `DB_USER` in `.env` to your Mac username (run `whoami` to find it).

**Solution (Windows):**
Ensure `DB_USER=postgres` and `DB_PASSWORD` is set to the password you created during PostgreSQL installation.

---

### Issue 2: pg_config Not Found

**Error:**
```
Error: pg_config executable not found
```

**Solution (macOS):**
```bash
# Install PostgreSQL
brew install postgresql@15

# Add to PATH (permanently)
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Reinstall psycopg2
pip install --force-reinstall psycopg2-binary
```

**Solution (Windows):**
```cmd
# Add PostgreSQL bin to PATH
# Go to: Control Panel > System > Advanced > Environment Variables
# Add to PATH: C:\Program Files\PostgreSQL\15\bin

# Or use psycopg2-binary (no compilation needed)
pip install --force-reinstall psycopg2-binary
```

---

### Issue 3: Python Version Mismatch

**Error:**
```
ERROR: Django 5.0 requires Python 3.10+
```

**Solution (macOS):**
```bash
# Install Python 3.12 (recommended)
brew install python@3.12

# Remove old virtual environment
rm -rf venv

# Create new virtual environment
python3.12 -m venv venv

# Activate and reinstall dependencies
source venv/bin/activate
pip install --upgrade pip
pip install setuptools
pip install -r requirements.txt
```

**Solution (Windows):**
```cmd
# Download and install Python 3.12 from python.org

# Remove old virtual environment
rmdir /s venv

# Create new virtual environment
python -m venv venv

# Activate and reinstall dependencies
venv\Scripts\activate.bat
pip install --upgrade pip
pip install setuptools
pip install -r requirements.txt
```

---

### Issue 4: Module Not Found (pkg_resources)

**Error:**
```
ModuleNotFoundError: No module named 'pkg_resources'
```

**Solution (All platforms):**
```bash
pip install setuptools
```

---

### Issue 5: Port Already in Use

**Error:**
```
Error: That port is already in use.
```

**Solution (macOS/Linux):**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or run on different port
python3 manage.py runserver 8001
```

**Solution (Windows):**
```cmd
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or run on different port
python manage.py runserver 8001
```

---

### Issue 6: PowerShell Execution Policy Error

**Error (Windows only):**
```
venv\Scripts\Activate.ps1 cannot be loaded because running scripts is disabled
```

**Solution:**
```powershell
# Run PowerShell as Administrator and execute:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try activating again
venv\Scripts\Activate.ps1
```

---

### Issue 7: Pandas/NumPy Compilation Errors

**Solution:**  
The `requirements.txt` uses flexible versioning (e.g., `pandas>=2.2.0`). If you encounter compilation issues:

```bash
# Update requirements to latest compatible versions
pip install --upgrade numpy pandas scipy scikit-learn
```

---

### Issue 8: SHAP / numba Incompatibility with Python 3.13

**Error:**
```
ModuleNotFoundError: No module named 'coverage.types'
# or
AttributeError: module 'numba' has no attribute 'core'
```

**Cause:** SHAP depends on `numba`, which has compatibility issues with Python 3.13. The `numba` JIT compiler requires `coverage >= 7.0` for its tracer, and some versions don't fully support 3.13.

**Solution:** Use **Python 3.12** (recommended):

**macOS:**
```bash
brew install python@3.12
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

**Windows:**
```cmd
# Download Python 3.12 from python.org and reinstall
rmdir /s venv
python -m venv venv
venv\Scripts\activate.bat
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

If you must stay on Python 3.13, ensure:
```bash
pip install "coverage>=7.0" "shap>=0.51.0" "numba>=0.60.0"
```

---

### Issue 9: Model Not Found When Running Counterfactuals

**Error:**
```
ERROR: Trained model not found. Run train_shap_adult.py first.
```

**Solution:** Train the model before generating counterfactuals:
```bash
python train_shap_adult.py
# Then:
python generate_counterfactuals.py
```

---

## Installed Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 5.0 | Web framework |
| djangorestframework | 3.14.0 | REST API framework |
| django-cors-headers | 4.3.1 | CORS handling |
| django-environ | 0.11.2 | Environment variable management |
| psycopg2-binary | 2.9.11 | PostgreSQL adapter |
| numpy | ≥1.26.0 | Numerical computing |
| pandas | ≥2.2.0 | Data manipulation |
| scikit-learn | ≥1.3.0 | Machine learning |
| xgboost | ≥2.0.0 | Gradient boosting (classifier) |
| lightgbm | ≥4.0.0 | Gradient boosting |
| shap | ≥0.50.0 | SHAP explainability (TreeSHAP) |
| dice-ml | ≥0.11 | DiCE counterfactual explanations |
| matplotlib | ≥3.7.0 | Visualisation & plots |
| scipy | ≥1.13.0 | Scientific computing |
| joblib | ≥1.3.0 | Model serialization |
| coverage | ≥7.0 | Test coverage (also required by numba) |
| drf-yasg | 1.21.7 | API documentation |
| pytest | 7.4.3 | Testing framework |
| pytest-django | 4.7.0 | Django testing integration |
| black | 23.12.1 | Code formatter |
| flake8 | 6.1.0 | Code linter |

---

## What's Next?

Now that you have FlipAI set up:

1. **Train the SHAP-Guided Model**:
   ```bash
   python train_shap_adult.py
   ```
   - Trains XGBoost on the Adult Census dataset with SHAP-integrated sample reweighting
   - Generates SHAP explanation plots in `models/saved_models/`

2. **Generate Counterfactual Explanations**:
   ```bash
   python generate_counterfactuals.py --custom
   ```
   - Enter a person's details and see what changes would flip the prediction
   - See [ML Pipeline](#ml-pipeline--training--counterfactuals) for full usage

3. **Explore the Admin Panel**: http://localhost:8000/admin/
   - Create test datasets
   - Familiarize yourself with the data models

4. **Check the API Documentation**: http://localhost:8000/swagger/
   - See all available endpoints
   - Test API calls interactively

5. **Review the Architecture**: See **[DEVELOPMENT.md](DEVELOPMENT.md)**
   - Understand project structure
   - View implementation tasks and TODO list

6. **Learn the Workflow**: See **[CONTRIBUTING.md](CONTRIBUTING.md)**
   - Daily development workflow
   - Git branching strategy
   - Code style guidelines

7. **Run Tests**
   ```bash
   pytest
   ```

---

## Additional Resources

- **Django Documentation:** https://docs.djangoproject.com/en/5.0/
- **Django REST Framework:** https://www.django-rest-framework.org/
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **SHAP Documentation:** https://shap.readthedocs.io/
- **DiCE-ML Documentation:** https://interpret.ml/DiCE/
- **XGBoost Documentation:** https://xgboost.readthedocs.io/
- **LightGBM Documentation:** https://lightgbm.readthedocs.io/

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review error messages carefully
3. Search for similar issues on Stack Overflow
4. Contact your team lead
5. Create an issue in the project repository

---

**Happy Coding! 🚀**
