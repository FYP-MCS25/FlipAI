# FlipAI Development Notes

## Project Structure

```
FlipAI/
├── flipai/              # Main Django project settings
│   ├── settings.py      # Project settings (PostgreSQL, REST framework)
│   ├── urls.py          # Main URL configuration
│   └── wsgi.py          # WSGI config for deployment
│
├── datasets/            # Dataset management app
│   ├── models.py        # Dataset, DatasetColumn models
│   ├── views.py         # Dataset CRUD endpoints
│   ├── serializers.py   # DRF serializers
│   └── admin.py         # Django admin interface
│
├── models/              # ML model app
│   ├── models.py        # MLModel, TrainingJob models
│   ├── views.py         # Model training and management
│   ├── serializers.py   # DRF serializers
│   └── admin.py         # Django admin interface
│
├── predictions/         # Predictions and counterfactuals app
│   ├── models.py        # Prediction, Counterfactual, SHAP models
│   ├── views.py         # Prediction and counterfactual endpoints
│   ├── serializers.py   # DRF serializers
│   └── admin.py         # Django admin interface
│
├── api/                 # API routing
│   └── urls.py          # API URL configuration
│
├── media/               # Uploaded files
│   └── datasets/        # Dataset files
│
├── models/saved_models/ # Trained model files
│
└── static/              # Static files
```

## API Endpoints

### Datasets
- `GET /api/v1/datasets/` - List all datasets
- `POST /api/v1/datasets/` - Upload new dataset
- `GET /api/v1/datasets/{id}/` - Get dataset details
- `GET /api/v1/datasets/{id}/statistics/` - Get dataset statistics
- `POST /api/v1/datasets/{id}/process/` - Process dataset

### Models
- `GET /api/v1/models/` - List all models
- `POST /api/v1/models/` - Create model
- `POST /api/v1/models/train/` - Train new model
- `GET /api/v1/models/{id}/` - Get model details
- `POST /api/v1/models/{id}/predict/` - Make prediction

### Predictions
- `GET /api/v1/predictions/` - List predictions
- `POST /api/v1/predictions/predict/` - Make new prediction
- `GET /api/v1/predictions/{id}/` - Get prediction details
- `GET /api/v1/predictions/{id}/shap/` - Get SHAP explanation
- `POST /api/v1/predictions/{id}/find_counterfactuals/` - Find counterfactuals

### Counterfactuals
- `GET /api/v1/counterfactuals/` - List counterfactuals
- `GET /api/v1/counterfactuals/{id}/` - Get counterfactual details

## TODO - Implementation Tasks

### Phase 1: Dataset Processing
- [ ] Implement dataset file parsing (CSV, Excel)
- [ ] Extract column metadata and statistics
- [ ] Data validation and cleaning
- [ ] Feature engineering utilities

### Phase 2: Model Training
- [ ] Implement model training pipeline
- [ ] Support for multiple model types (RF, XGBoost, etc.)
- [ ] Hyperparameter tuning
- [ ] Model evaluation and metrics
- [ ] Model serialization and storage

### Phase 3: Prediction System
- [ ] Load trained models
- [ ] Input validation and preprocessing
- [ ] Prediction generation
- [ ] SHAP value calculation
- [ ] Feature importance analysis

### Phase 4: Counterfactual Generation
- [ ] Implement counterfactual search algorithm
- [ ] SHAP-guided feature selection
- [ ] Distance metrics and optimization
- [ ] Actionability constraints
- [ ] Multiple counterfactual ranking

### Phase 5: Frontend Integration
- [ ] API authentication
- [ ] File upload handling
- [ ] Async task processing
- [ ] WebSocket for real-time updates

### Phase 6: Testing & Deployment
- [ ] Unit tests for all components
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Docker configuration
- [ ] Production deployment setup

## Database Models

### Dataset
- Stores uploaded datasets with metadata
- Tracks processing status
- Related to DatasetColumn for detailed column info

### MLModel
- Stores trained models
- Links to training dataset
- Stores hyperparameters and metrics

### Prediction
- Stores prediction results
- Links to model used
- Includes input data hash for caching

### Counterfactual
- Stores counterfactual explanations
- Links to original prediction
- Includes distance metrics and feature changes

### SHAPExplanation
- Stores SHAP values for predictions
- Feature importance rankings
- Visualization data

## Environment Variables

See `.env.example` for all required environment variables:
- Database credentials
- Secret key
- File upload limits
- CORS settings

## Notes for Team

1. **Database**: Make sure PostgreSQL is running before starting the server
2. **Migrations**: Run `python manage.py makemigrations` after model changes
3. **Testing**: Use pytest for testing, not Django's default test runner
4. **Code Style**: Run `black .` before committing
5. **API Docs**: Check Swagger UI at `/swagger/` for interactive API documentation
