// API Service for communicating with Django backend
import config from './config';

const apiUrl = config.apiUrl;
const ACCESS_TOKEN_KEY = 'flipai_access_token';
const REFRESH_TOKEN_KEY = 'flipai_refresh_token';

export function setAuthTokens({ access, refresh }) {
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Generic fetch wrapper with error handling
 */
async function request(endpoint, options = {}, isFileUpload = false) {
  const url = `${apiUrl}${endpoint}`;

  const getAuthHeader = () => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const executeFetch = async () => {
    const headers = {
      ...getAuthHeader(),
      ...options.headers,
    };

    // Only set JSON content type if not uploading a file and body is not FormData
    if (!isFileUpload && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  try {
    let response = await executeFetch();

    // Handle 401 Unauthorized - Attempt token refresh
    if (response.status === 401 && !endpoint.includes('/auth/token/refresh/') && getRefreshToken()) {
      try {
        const refresh = getRefreshToken();
        const refreshResponse = await fetch(`${apiUrl}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });

        if (refreshResponse.ok) {
          const payload = await refreshResponse.json();
          setAuthTokens({ access: payload.access, refresh: payload.refresh || refresh });

          // Retry the original request with the new token
          response = await executeFetch();
        } else {
          clearAuthTokens();
          // Optionally trigger a custom event or redirect to login here
          // window.dispatchEvent(new Event('session-expired'));
        }
      } catch (refreshError) {
        clearAuthTokens();
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      // Attach status for easier handling in routes/components
      error.status = response.status;
      throw error;
    }

    // 204 No Content (e.g. DELETE) has no body — skip JSON parsing
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error(isFileUpload ? 'Upload Error:' : 'API Error:', error);
    throw error;
  }
}

export async function fetchAPI(endpoint, options = {}) {
  return request(endpoint, options, false);
}

/**
 * Generic fetch for file uploads (FormData)
 */
async function uploadFile(endpoint, formData) {
  return request(endpoint, { method: 'POST', body: formData }, true);
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

// ============ Authentication APIs ============

export const authAPI = {
  googleChallenge: () => fetchAPI('/auth/google-challenge/'),

  googleSignIn: async (idToken, state) => {
    const authPayload = await fetchAPI('/auth/google-sign-in/', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken, state }),
    });

    if (authPayload.access && authPayload.refresh) {
      setAuthTokens({ access: authPayload.access, refresh: authPayload.refresh });
    }

    return authPayload;
  },

  refreshToken: async () => {
    const refresh = getRefreshToken();
    if (!refresh) {
      throw new Error('No refresh token available');
    }

    const payload = await fetchAPI('/auth/token/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    });

    if (payload.access) {
      setAuthTokens({ access: payload.access, refresh: payload.refresh || refresh });
    }

    return payload;
  },

  me: () => fetchAPI('/auth/me/'),

  logout: async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      await fetchAPI('/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      });
    }
    clearAuthTokens();
  },
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
  authAPI,
};
