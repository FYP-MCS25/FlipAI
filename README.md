# FlipAI - Actionable Explanations with SHAP-Guided Counterfactuals

FlipAI is a machine learning prediction and explainability platform that helps users understand how to change input features to flip prediction outcomes using SHAP-guided counterfactual analysis.

## 🚀 Quick Start

**New to the project?** Get started in 5 minutes:

### **[👉 Setup Guide - Start Here!](SETUP_GUIDE.md)**

Complete installation guide with troubleshooting for all common issues.

## 📚 Documentation

| Document | Purpose | For Who |
|----------|---------|---------|
| **[SETUP_GUIDE.md](SETUP_GUIDE.md)** | Complete installation, database setup, troubleshooting | **New developers** setting up locally |
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Architecture, implementation tasks, TODO list | **Active developers** building features |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Git workflow, code style, team collaboration | **All contributors** |

## ⚡ Quick Reference

### Start Development Server
```bash
source venv/bin/activate
python3 manage.py runserver
```

### Access Points
- **Home**: http://localhost:8000/
- **Admin Panel**: http://localhost:8000/admin/
- **API Docs (Swagger)**: http://localhost:8000/swagger/
- **API Docs (ReDoc)**: http://localhost:8000/redoc/
- **API Root**: http://localhost:8000/api/v1/

---

## 🎯 What is FlipAI?

FlipAI helps users understand **actionable changes** to input data that would flip the outcome.

### Example Use Case

**Scenario**: Loan application denied  
**Question**: "What changes would get my loan approved?"  
**FlipAI Answer**: "Increase income by $5,000 AND reduce debt-to-income ratio to 30% → 85% approval probability"

### Key Features

- **Dataset Management**: Upload CSV/Excel datasets for model training
- **Model Training**: Train models (Random Forest, XGBoost, LightGBM) or use pre-trained ones
- **Predictions**: Make predictions on new data points with confidence scores
- **Counterfactual Analysis**: Find minimal changes to flip predictions
- **SHAP Explanations**: Understand which features drove the prediction

---

## 🛠️ Tech Stack

- **Backend**: Django 5.0 with Django REST Framework
- **Database**: PostgreSQL 15
- **Python**: 3.12 (recommended)
- **ML Libraries**: scikit-learn, XGBoost, LightGBM, NumPy, Pandas
- **Explainability**: SHAP (SHapley Additive exPlanations)
- **Counterfactuals**: DiCE-ML (Diverse Counterfactual Explanations)
- **API Docs**: Swagger/ReDoc (drf-yasg)
- **Testing**: pytest, pytest-django

---

## 🧪 Development Commands

```bash
# Train the SHAP-guided model
python train_shap_adult.py

# Generate counterfactual explanations
python generate_counterfactuals.py              # random sample
python generate_counterfactuals.py --custom      # interactive input
python generate_counterfactuals.py --index 42    # specific sample

# Run tests
pytest

# Format code
black .

# Check code style
flake8

# Create migrations (after model changes)
python3 manage.py makemigrations

# Apply migrations
python3 manage.py migrate

# Create superuser
python3 manage.py createsuperuser
```

---

## 👥 Team Collaboration

1. Read **[CONTRIBUTING.md](CONTRIBUTING.md)** for git workflow
2. Check **[DEVELOPMENT.md](DEVELOPMENT.md)** for current tasks
3. Create feature branches from `dev`
4. Submit pull requests for review
5. Run tests before pushing

---

## 📖 Additional Resources

- **Django Docs**: https://docs.djangoproject.com/en/5.0/
- **Django REST Framework**: https://www.django-rest-framework.org/
- **SHAP Docs**: https://shap.readthedocs.io/
- **XGBoost Docs**: https://xgboost.readthedocs.io/

---

## 🆘 Need Help?

1. Check **[SETUP_GUIDE.md](SETUP_GUIDE.md)** troubleshooting section
2. Search existing issues in the repository
3. Ask your team lead
4. Create a new issue with detailed error messages

---

**Happy Coding! 🚀**
