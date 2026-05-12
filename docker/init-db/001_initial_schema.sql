-- ============================================================================
-- FlipAI PostgreSQL Database Schema
-- ============================================================================
-- Production-quality SQL schema for FlipAI counterfactual explanation system
-- This schema supports Django ORM and includes custom extensions
-- Generated: 2026-04-07
-- ============================================================================

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS predictions_counterfactualsearch CASCADE;
DROP TABLE IF EXISTS predictions_shapexplanation CASCADE;
DROP TABLE IF EXISTS predictions_counterfactual CASCADE;
DROP TABLE IF EXISTS predictions_prediction CASCADE;
DROP TABLE IF EXISTS models_trainingjob CASCADE;
DROP TABLE IF EXISTS models_mlmodel CASCADE;
DROP TABLE IF EXISTS datasets_datasetcolumn CASCADE;
DROP TABLE IF EXISTS analysis_chat CASCADE;
DROP TABLE IF EXISTS datasets_dataset CASCADE;

-- ============================================================================
-- TABLE 1: DATASETS_DATASET
-- ============================================================================
-- Purpose: Store uploaded datasets
-- Each dataset belongs to one user
-- Tracks file location, metadata, and processing status
-- ============================================================================
CREATE TABLE datasets_dataset (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file VARCHAR(100) NOT NULL,

    uploaded_by_id INTEGER NOT NULL,  -- FK added later by Django

    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    num_rows INTEGER,
    num_columns INTEGER,

    column_names JSONB,
    column_types JSONB,

    is_processed BOOLEAN DEFAULT FALSE,

    CONSTRAINT dataset_name_unique_per_user
        UNIQUE(uploaded_by_id, name),

    CONSTRAINT dataset_num_rows_positive
        CHECK (num_rows IS NULL OR num_rows > 0),

    CONSTRAINT dataset_num_columns_positive
        CHECK (num_columns IS NULL OR num_columns > 0)
);

CREATE INDEX idx_dataset_uploaded_by_id
    ON datasets_dataset(uploaded_by_id);

CREATE INDEX idx_dataset_uploaded_at
    ON datasets_dataset(uploaded_at);

CREATE INDEX idx_dataset_is_processed
    ON datasets_dataset(is_processed);

-- ============================================================================
-- TABLE 2: ANALYSIS_CHAT
-- ============================================================================
-- Purpose: Track analysis sessions (model training contexts)
-- Each analysis session is tied to a dataset and user
-- Multiple predictions can be made within one analysis session
-- ============================================================================
CREATE TABLE analysis_chat (
    ac_id BIGSERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL,  -- FK added later by Django

    dataset_id BIGINT NOT NULL,

    analysis_name VARCHAR(255) NOT NULL,
    description TEXT,

    model_type VARCHAR(50) NOT NULL,
    target_feature VARCHAR(255) NOT NULL,

    frozen_features JSONB,
    feature_list JSONB,

    num_features INTEGER,

    status VARCHAR(20) DEFAULT 'active',
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ac_analysis_name_unique
        UNIQUE(user_id, dataset_id, analysis_name),

    CONSTRAINT ac_model_type_valid
        CHECK (
            model_type IN (
                'random_forest',
                'xgboost',
                'lightgbm',
                'logistic_regression',
                'svm',
                'neural_network'
            )
        ),

    CONSTRAINT ac_status_valid
        CHECK (
            status IN (
                'active',
                'archived',
                'failed'
            )
        )
);

CREATE INDEX idx_ac_user_id
    ON analysis_chat(user_id);

CREATE INDEX idx_ac_dataset_id
    ON analysis_chat(dataset_id);

CREATE INDEX idx_ac_created_at
    ON analysis_chat(created_at);

-- ============================================================================
-- TABLE 3: DATASETS_DATASETCOLUMN
-- ============================================================================
-- Purpose: Store metadata about individual dataset columns
-- Tracks column statistics (min, max, mean, std for numeric)
-- Tracks categorical values and missing data info
-- ============================================================================
CREATE TABLE datasets_datasetcolumn (
    id BIGSERIAL PRIMARY KEY,

    dataset_id BIGINT NOT NULL
        REFERENCES datasets_dataset(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    data_type VARCHAR(50) NOT NULL,

    is_target BOOLEAN DEFAULT FALSE,
    is_feature BOOLEAN DEFAULT TRUE,

    min_value FLOAT8,
    max_value FLOAT8,
    mean_value FLOAT8,
    std_value FLOAT8,

    unique_values JSONB,
    num_unique INTEGER,

    missing_count INTEGER DEFAULT 0,
    missing_percentage FLOAT8 DEFAULT 0.0,

    CONSTRAINT dc_unique_per_dataset
        UNIQUE(dataset_id, name),

    CONSTRAINT dc_data_type_valid
        CHECK (
            data_type IN (
                'continuous',
                'categorical',
                'datetime',
                'text'
            )
        ),

    CONSTRAINT dc_missing_percentage_valid
        CHECK (
            missing_percentage >= 0
            AND missing_percentage <= 100
        ),

    CONSTRAINT dc_min_max_numeric
        CHECK (
            data_type != 'continuous'
            OR (
                min_value IS NULL
                AND max_value IS NULL
            )
            OR (
                min_value <= max_value
            )
        )
);

CREATE INDEX idx_dc_dataset_id
    ON datasets_datasetcolumn(dataset_id);

-- ============================================================================
-- TABLE 4: MODELS_MLMODEL
-- ============================================================================
-- Purpose: Store trained machine learning models
-- Each model is trained on a specific dataset
-- Includes hyperparameters and performance metrics
-- ============================================================================
CREATE TABLE models_mlmodel (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    model_type VARCHAR(50) NOT NULL,
    task_type VARCHAR(20) NOT NULL,

    dataset_id BIGINT
        REFERENCES datasets_dataset(id)
        ON DELETE SET NULL,

    model_file VARCHAR(100) NOT NULL,

    feature_names JSONB,
    target_name VARCHAR(255),
    hyperparameters JSONB,

    train_accuracy FLOAT8,
    test_accuracy FLOAT8,

    train_metrics JSONB,
    test_metrics JSONB,

    is_trained BOOLEAN DEFAULT FALSE,
    is_pretrained BOOLEAN DEFAULT FALSE,

    created_by_id INTEGER NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT mlm_model_type_valid
        CHECK (
            model_type IN (
                'random_forest',
                'gradient_boosting',
                'xgboost',
                'lightgbm',
                'logistic_regression',
                'svm',
                'neural_network'
            )
        ),

    CONSTRAINT mlm_task_type_valid
        CHECK (
            task_type IN (
                'classification',
                'regression'
            )
        )
);

CREATE INDEX idx_mlm_dataset_id
    ON models_mlmodel(dataset_id);

-- ============================================================================
-- TABLE 5: MODELS_TRAININGJOB
-- ============================================================================
-- Purpose: Track training job execution
-- Allows monitoring of long-running training processes
-- Stores training logs and error messages
-- ============================================================================
CREATE TABLE models_trainingjob (
    id BIGSERIAL PRIMARY KEY,

    model_id BIGINT NOT NULL
        REFERENCES models_mlmodel(id)
        ON DELETE CASCADE,

    status VARCHAR(20) DEFAULT 'pending',

    train_test_split FLOAT8 DEFAULT 0.8,
    random_state INTEGER DEFAULT 42,

    progress_percentage FLOAT8 DEFAULT 0.0,
    current_step VARCHAR(255),

    error_message TEXT,
    training_log TEXT,

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tj_model_id
    ON models_trainingjob(model_id);

-- ============================================================================
-- TABLE 6: PREDICTIONS_PREDICTION
-- ============================================================================
-- Purpose: Store individual prediction requests and results
-- Each prediction is tied to a model
-- Includes input data, results, and optional probabilities
-- ============================================================================
CREATE TABLE predictions_prediction (
    id BIGSERIAL PRIMARY KEY,

    model_id BIGINT NOT NULL
        REFERENCES models_mlmodel(id)
        ON DELETE CASCADE,

    input_data JSONB NOT NULL,
    input_hash VARCHAR(64) NOT NULL,

    prediction_value FLOAT8 NOT NULL,
    prediction_class VARCHAR(255),
    prediction_probabilities JSONB,

    confidence FLOAT8,

    created_by_id INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pred_model_id
    ON predictions_prediction(model_id);

-- ============================================================================
-- TABLE 7: PREDICTIONS_COUNTERFACTUAL
-- ============================================================================
-- Purpose: Store generated counterfactual explanations
-- Each counterfactual is tied to a prediction
-- Tracks changes, distances, and actionability
-- ============================================================================
CREATE TABLE predictions_counterfactual (
    id BIGSERIAL PRIMARY KEY,

    prediction_id BIGINT NOT NULL
        REFERENCES predictions_prediction(id)
        ON DELETE CASCADE,

    counterfactual_data JSONB NOT NULL,
    counterfactual_prediction FLOAT8 NOT NULL,
    counterfactual_class VARCHAR(255),

    distance FLOAT8 NOT NULL,
    num_changes INTEGER NOT NULL,

    changed_features JSONB NOT NULL,

    is_actionable BOOLEAN DEFAULT TRUE,
    actionability_score FLOAT8,

    feature_changes JSONB,

    rank INTEGER DEFAULT 1,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cf_prediction_id
    ON predictions_counterfactual(prediction_id);

-- ============================================================================
-- TABLE 8: PREDICTIONS_SHAPEXPLANATION
-- ============================================================================
-- Purpose: Store SHAP (SHapley Additive exPlanations) values
-- One-to-one relationship with predictions
-- Tracks feature importance and visualization data
-- ============================================================================
CREATE TABLE predictions_shapexplanation (
    id BIGSERIAL PRIMARY KEY,

    prediction_id BIGINT NOT NULL UNIQUE
        REFERENCES predictions_prediction(id)
        ON DELETE CASCADE,

    shap_values JSONB NOT NULL,
    base_value FLOAT8 NOT NULL,

    feature_importance JSONB NOT NULL,

    force_plot_data JSONB,
    waterfall_data JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 9: PREDICTIONS_COUNTERFACTUALSEARCH
-- ============================================================================
-- Purpose: Track counterfactual search/generation jobs
-- Allows monitoring of long-running CF generation
-- Stores search parameters and results summary
-- ============================================================================
CREATE TABLE predictions_counterfactualsearch (
    id BIGSERIAL PRIMARY KEY,

    prediction_id BIGINT NOT NULL
        REFERENCES predictions_prediction(id)
        ON DELETE CASCADE,

    status VARCHAR(20) DEFAULT 'pending',

    max_iterations INTEGER DEFAULT 1000,

    desired_class VARCHAR(255),
    feature_constraints JSONB,

    num_counterfactuals_found INTEGER DEFAULT 0,
    error_message TEXT,

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ADD FK AFTER TABLES EXIST
-- ============================================================================

ALTER TABLE analysis_chat
ADD CONSTRAINT fk_ac_dataset_id
FOREIGN KEY (dataset_id)
REFERENCES datasets_dataset(id)
ON DELETE CASCADE;

-- ============================================================================
-- TABLESPACE OPTIMIZATION (Optional - for large deployments)
-- ============================================================================
-- CREATE TABLESPACE flipai_data LOCATION '/var/lib/postgresql/flipai_data';
-- ALTER TABLE predictions_prediction SET TABLESPACE flipai_data;
-- ALTER TABLE predictions_counterfactual SET TABLESPACE flipai_data;

-- ============================================================================
-- SUMMARY OF TABLES AND RELATIONSHIPS
-- ============================================================================
-- 
-- auth_user (Django built-in)
--   ├── analysis_chat (1:M)
--   ├── datasets_dataset (1:M)
--   ├── models_mlmodel (1:M)
--   ├── predictions_prediction (1:M)
--   └── various *_by_id foreign keys
--
-- datasets_dataset
--   ├── analysis_chat (1:M)
--   ├── datasets_datasetcolumn (1:M)
--   └── models_mlmodel (1:M)
--
-- datasets_datasetcolumn (Column metadata)
--
-- analysis_chat (Analysis/Model Training Session)
--
-- models_mlmodel (Trained ML Model)
--   ├── models_trainingjob (1:M)
--   └── predictions_prediction (1:M)
--
-- models_trainingjob (Training Job Tracking)
--
-- predictions_prediction (Single Prediction)
--   ├── predictions_counterfactual (1:M)
--   ├── predictions_shapexplanation (1:1)
--   └── predictions_counterfactualSearch (1:M)
--
-- predictions_counterfactual (Counterfactual Explanation)
-- predictions_shapexplanation (SHAP Explanation)
-- predictions_counterfactualSearch (CF Search Job)
--
-- ============================================================================
-- DESIGN DECISIONS
-- ============================================================================
--
-- 1. PRIMARY KEYS: BIGSERIAL for auto-incrementing IDs
--    - Chosen over UUID for better index performance
--    - Supports Django's default ID generation
--
-- 2. JSONB for Flexible Data: Used for:
--    - column_names, column_types (dataset schema)
--    - hyperparameters (model configuration)
--    - metric objects (train_metrics, test_metrics)
--    - input_data, counterfactual_data (feature vectors)
--    - shap_values, feature_importance (ML output)
--    - Allows future extensions without schema changes
--
-- 3. TIMESTAMPS: TIMESTAMP WITH TIME ZONE for all timestamps
--    - Ensures consistent handling across timezones
--    - Supports international teams
--
-- 4. CONSTRAINTS:
--    - CHECK constraints for validation (ranges, enum values)
--    - UNIQUE for preventing duplicates
--    - NOT NULL for required fields
--    - FOREIGN KEY with ON DELETE CASCADE for related cleanup
--
-- 5. INDEXES:
--    - Foreign key columns indexed for JOIN performance
--    - Status columns indexed for filtering
--    - created_at indexed for time-series queries
--    - Composite indexes for common query patterns
--
-- 6. NAMING CONVENTION:
--    - Tables: snake_case with app prefix (datasets_, models_, predictions_)
--    - Columns: snake_case
--    - Constraints: descriptive names with table prefix
--    - Indexes: idx_tablename_column format
--
-- 7. DJANGO COMPATIBILITY:
--    - Uses Django field naming conventions
--    - Compatible with Django migrations
--    - ForeignKey references use _id suffix
--    - auto_now_add and auto_now simulate with DEFAULT CURRENT_TIMESTAMP
--
-- ============================================================================
-- PERFORMANCE CONSIDERATIONS
-- ============================================================================
--
-- For large-scale deployments:
-- 1. Consider partitioning predictions table by date
-- 2. Archive old counterfactual searches periodically
-- 3. Create materialized views for reporting
-- 4. Use UNLOGGED tables for temporary computation data
-- 5. Monitor index usage and vacuum regularly
--
-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
--
-- 1. Column-level encryption for sensitive data can be added
-- 2. Audit triggers can track modifications
-- 3. Row-level security policies can be added for multi-tenant scenarios
-- 4. Regular backups are critical for model files and training results
--
-- ============================================================================

-- Verify schema creation
\dt