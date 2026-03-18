// API Service for communicating with Django backend
import config from './config';

const apiUrl = config.apiUrl;

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${apiUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Generic fetch for file uploads (FormData)
 */
async function uploadFile(endpoint, formData) {
  const url = `${apiUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
}

// ============ Dataset APIs ============

export const datasetAPI = {
  /**
   * Get all datasets
   */
  getAll: () => fetchAPI('/datasets/'),

  /**
   * Get a specific dataset by ID
   */
  getById: (id) => fetchAPI(`/datasets/${id}/`),

  /**
   * Upload a new dataset
   * @param {File} file - The CSV file to upload
   * @param {string} name - Name of the dataset
   * @param {string} description - Optional description
   */
  upload: (file, name, description = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }
    return uploadFile('/datasets/upload/', formData);
  },

  /**
   * Delete a dataset
   */
  delete: (id) => fetchAPI(`/datasets/${id}/`, { method: 'DELETE' }),
};

// ============ Model APIs ============

export const modelAPI = {
  /**
   * Get all models
   */
  getAll: () => fetchAPI('/models/'),

  /**
   * Get a specific model by ID
   */
  getById: (id) => fetchAPI(`/models/${id}/`),

  /**
   * Train a new model
   * @param {Object} config - Training configuration
   */
  train: (config) => fetchAPI('/models/train/', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  /**
   * Delete a model
   */
  delete: (id) => fetchAPI(`/models/${id}/`, { method: 'DELETE' }),
};

// ============ Prediction APIs ============

export const predictionAPI = {
  /**
   * Get all predictions
   */
  getAll: () => fetchAPI('/predictions/'),

  /**
   * Get a specific prediction by ID
   */
  getById: (id) => fetchAPI(`/predictions/${id}/`),

  /**
   * Make a prediction
   * @param {Object} data - Prediction input data
   */
  predict: (data) => fetchAPI('/predictions/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  /**
   * Get explanations for a prediction
   */
  getExplanation: (id) => fetchAPI(`/predictions/${id}/explanation/`),

  /**
   * Get counterfactuals for a prediction
   */
  getCounterfactuals: (id) => fetchAPI(`/predictions/${id}/counterfactuals/`),
};

// ============ Example Usage ============

/*
// In your React component:

import { datasetAPI, modelAPI, predictionAPI } from './apiService';

// Fetch all datasets
datasetAPI.getAll()
  .then(datasets => console.log(datasets))
  .catch(error => console.error(error));

// Upload a dataset
const handleFileUpload = async (file) => {
  try {
    const result = await datasetAPI.upload(file, 'My Dataset', 'Test data');
    console.log('Upload successful:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};

// Train a model
modelAPI.train({
  dataset_id: 1,
  model_type: 'xgboost',
  hyperparameters: { max_depth: 6, learning_rate: 0.1 }
})
  .then(result => console.log('Training started:', result))
  .catch(error => console.error(error));

// Make a prediction
predictionAPI.predict({
  model_id: 1,
  input_data: { feature1: 10, feature2: 20, feature3: 30 }
})
  .then(result => console.log('Prediction:', result))
  .catch(error => console.error(error));
*/

export default {
  datasetAPI,
  modelAPI,
  predictionAPI,
};
