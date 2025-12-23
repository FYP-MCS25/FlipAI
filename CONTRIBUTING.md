# Contributing to FlipAI

Thank you for your interest in contributing to FlipAI!

## Daily Workflow

**macOS/Linux:**
```bash
# 1. Navigate to project
cd /path/to/FlipAI

# 2. Activate virtual environment
source venv/bin/activate

# 3. Pull latest changes
git pull origin main

# 4. Install any new dependencies (if requirements.txt changed)
pip install -r requirements.txt

# 5. Apply any new migrations
python3 manage.py migrate

# 6. Start development server
python3 manage.py runserver
```

**Windows (Command Prompt):**
```cmd
# 1. Navigate to project
cd C:\path\to\FlipAI

# 2. Activate virtual environment
venv\Scripts\activate.bat

# 3. Pull latest changes
git pull origin main

# 4. Install any new dependencies (if requirements.txt changed)
pip install -r requirements.txt

# 5. Apply any new migrations
python manage.py migrate

# 6. Start development server
python manage.py runserver
```

**Windows (PowerShell):**
```powershell
# 1. Navigate to project
cd C:\path\to\FlipAI

# 2. Activate virtual environment
venv\Scripts\Activate.ps1

# 3. Pull latest changes
git pull origin main

# 4. Install any new dependencies (if requirements.txt changed)
pip install -r requirements.txt

# 5. Apply any new migrations
python manage.py migrate

# 6. Start development server
python manage.py runserver
```

## Making Changes

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Follow PEP 8 style guidelines
- Add tests for new functionality
- Update documentation as needed

### 3. If You Modified Models

**macOS/Linux:**
```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

**Windows:**
```cmd
python manage.py makemigrations
python manage.py migrate
```

### 4. Run Tests
```bash
pytest
```

### 5. Format Code
```bash
black .    # Auto-format code
flake8     # Check style
```

### 6. Commit and Push
```bash
git add .
git commit -m "Brief description of changes"
git push origin feature/your-feature-name
```

### 7. Create Pull Request
- Go to GitHub and create a pull request
- Request review from team lead
- Address any feedback

## Code Style Guidelines

- **PEP 8**: Follow Python style guide
- **Black**: Use black for auto-formatting
- **Flake8**: Check for style issues
- **Docstrings**: Add docstrings to functions and classes
- **Type Hints**: Use type hints where appropriate

## Testing Guidelines

- Write tests for all new features in `tests.py`
- Aim for >80% code coverage
- Test edge cases and error handling
- Use pytest fixtures for reusable test data

## Commit Message Guidelines

```
type: Brief description (50 chars max)

Detailed explanation if needed (wrap at 72 chars)

Examples:
- feat: Add counterfactual search endpoint
- fix: Resolve SHAP calculation for categorical features
- docs: Update API documentation for predictions
- test: Add tests for dataset validation
- refactor: Simplify model training pipeline
```

## Questions?

Contact the team lead or open an issue on GitHub.
