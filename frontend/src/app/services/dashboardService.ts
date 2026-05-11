import { Dataset } from '../components/Dashboard';
import { getAccessToken } from '../../apiService';

export interface DashboardAnalysis {
  id: string;
  datasetId: string;
  datasetName: string;
  modelName: string;
  targetFeature: string;
  frozenFeatures: string[];
  createdAt: Date;
}

const API_BASE = 'http://localhost:8000/api/v1';

const authHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchAnalyses = async (): Promise<DashboardAnalysis[]> => {
  const res = await fetch(`${API_BASE}/analyses/`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to fetch analyses');
  const data = await res.json();
  
  return data.results.map((a: any) => {
    const datasetId = a.dataset_id ?? a.dataset;
    return {
      id: a.id.toString(),
      targetFeature: a.target_feature,
      frozenFeatures: a.frozen_features,
      datasetName: a.dataset_name,
      datasetId: datasetId != null ? String(datasetId) : '',
      modelName: a.model_name || 'XGBoost Classifier',
      createdAt: new Date(a.created_at),
    };
  });
};

export const fetchDatasets = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/datasets/`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to fetch datasets');
  const data = await res.json();
  return data.results;
};

export const fetchDatasetById = async (id: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/datasets/${id}/`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to fetch dataset');
  return res.json();
};

export const deleteAnalysis = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/analyses/${id}/`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) throw new Error('Failed to delete analysis');
};
