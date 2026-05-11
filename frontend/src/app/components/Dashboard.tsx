import { useEffect, useState } from 'react';
import { AnalysisSidebar } from './AnalysisSidebar';
import { AnalysisPanel } from './AnalysisPanel';
import { EmptyAnalysisState } from './EmptyAnalysisState';
import { UploadModal } from './UploadModal';
import { ExistingDatasetModal } from './ExistingDatasetModal';
import {
  FeatureConfigForm,
  type AnalysisCreateResponse,
  type TrainingUpdate,
} from './FeatureConfigForm';
import {
  CounterfactualConfigForm,
  type CounterfactualConfig,
  type PredictionSubmissionPayload,
} from './Counterfactualconfigform';
import { type TestAnalysis } from './CollapsibleAnalysis';
import { UserProfileModal } from './UserProfileModal';
import { PanelLeft, Plus, User } from 'lucide-react';
import { LoadingOverlay } from './ui/loading-overlay';
import { getAccessToken, authAPI } from '../../apiService';
import { fetchAnalyses, fetchDatasets, fetchDatasetById as fetchDatasetByIdService } from '../services/dashboardService';

type TrainingStatus = 'idle' | 'running' | 'completed' | 'failed';
type TrainingBannerTone = 'info' | 'success' | 'error';
type DashboardLoadingKind = 'dataset-upload' | 'model-training' | 'prediction';

interface TrainingBanner {
  analysisId: string;
  status: TrainingStatus;
  tone: TrainingBannerTone;
  message: string;
  detail?: string;
}

interface DashboardLoadingOverlay {
  kind: DashboardLoadingKind;
  title: string;
  detail: string;
}

interface Analysis {
  id: string;
  datasetId: string;  
  datasetName: string;
  modelName: string;
  targetFeature: string;
  frozenFeatures: string[];
  testAnalyses: TestAnalysis[];
  createdAt: Date;
  trainingStatus: TrainingStatus;
  trainingModelId: number | null;
  trainingMetrics: Record<string, unknown> | null;
  trainingFeatureImportance: unknown;
  trainingError: string | null;
}

interface DatasetColumn {
  id: number;
  name: string;
  data_type: string;
  is_target: boolean;
  is_feature: boolean;
  description: string;
  min_value: number | null;
  max_value: number | null;
  mean_value: number | null;
  std_value: number | null;
  unique_values: string[] | null;
  num_unique: number | null;
  missing_count: number;
  missing_percentage: number;
  dataset: number;
}

export interface Dataset {
  id: string;
  name: string;
  file?: File;
  uploadAt: Date;
  numRows: number;
  columnNames: string[];
  columns: DatasetColumn[];
}

// --- Step tracking for the multi-step new-analysis flow -----------------------
//
//  null                   -> no pending analysis (show existing or empty state)
//  'feature-config'       -> FeatureConfigForm  (pick target + frozen features)
//  'counterfactual-config'-> CounterfactualConfigForm (outcome condition + instance values)
//
type AnalysisStep = 'feature-config' | 'counterfactual-config';
type CounterfactualEntrySource = 'new-analysis' | 'existing-analysis';

interface PendingDataset {
  id: string;
  name: string;
  file?: File;
  uploadAt: Date;
  numRows: number;
  columnNames: string[];
  columns: DatasetColumn[];
  source: 'upload' | 'existing';
}

interface PendingConfig {
  targetFeature: string;
  frozenFeatures: string[];
}

export function Dashboard() {
  const authHeaders = (): Record<string, string> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        const loadedAnalyses = await fetchAnalyses();
        const formattedAnalyses = loadedAnalyses.map(a => ({
          ...a,
          testAnalyses: [],
          trainingStatus: 'idle' as TrainingStatus,
          trainingModelId: null,
          trainingMetrics: null,
          trainingFeatureImportance: null,
          trainingError: null,
        }));
        setAnalyses(formattedAnalyses);
      } catch (err) {
        console.error('Error fetching analyses:', err);
      }
    };
    loadAnalyses();
  }, []);

  const [existingDatasets, setExistingDatasets] = useState<Dataset[]>([]);
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const results = await fetchDatasets();
        const datasets: Dataset[] = results.map((d: any) => toDataset(d));
        setExistingDatasets(datasets);
      } catch (err) {
        console.error(err);
      }
    };
    loadDatasets();
  }, []);

  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [existingDatasetModalOpen, setExistingDatasetModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // -- Multi-step flow state --
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [pendingDataset, setPendingDataset] = useState<PendingDataset | null>(null);
  const [pendingConfig, setPendingConfig] = useState<PendingConfig | null>(null);
  const [counterfactualEntrySource, setCounterfactualEntrySource] =
    useState<CounterfactualEntrySource | null>(null);
  const [trainingBanner, setTrainingBanner] = useState<TrainingBanner | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<DashboardLoadingOverlay | null>(null);

  useEffect(() => {
    if (!trainingBanner || trainingBanner.status === 'running') return;

    const timeout = window.setTimeout(() => {
      setTrainingBanner((current) =>
        current &&
        current.analysisId === trainingBanner.analysisId &&
        current.status === trainingBanner.status
          ? null
          : current
      );
    }, 6000);

    return () => window.clearTimeout(timeout);
  }, [trainingBanner]);

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    authAPI.me().then((me) => {
      const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username;
      setUser({ name, email: me.email });
    }).catch(() => {});
  }, []);

  const currentAnalysis = analyses.find((a) => a.id === activeAnalysis);

  // -- Helpers ---------------------------------------------------------------

  const toDataset = (dataset: any): Dataset => ({
    id: dataset.id.toString(),
    name: dataset.name,
    uploadAt: new Date(dataset.uploaded_at),
    numRows: dataset.num_rows,
    columnNames: dataset.column_names ?? [],
    columns: dataset.columns ?? [],
  });

  const updateAnalysisTraining = (analysisId: string, updates: Partial<Analysis>) => {
    setAnalyses((prev) =>
      prev.map((analysis) => (analysis.id === analysisId ? { ...analysis, ...updates } : analysis))
    );
  };

  // Training API is triggered inside FeatureConfigForm; Dashboard only consumes updates.
  const handleTrainingUpdate = (update: TrainingUpdate) => {
    const analysisUpdates: Partial<Analysis> = {
      trainingStatus: update.status,
    };

    if (update.trainingModelId !== undefined) {
      analysisUpdates.trainingModelId = update.trainingModelId;
    }
    if (update.trainingMetrics !== undefined) {
      analysisUpdates.trainingMetrics = update.trainingMetrics;
    }
    if (update.trainingFeatureImportance !== undefined) {
      analysisUpdates.trainingFeatureImportance = update.trainingFeatureImportance;
    }
    if (update.trainingError !== undefined) {
      analysisUpdates.trainingError = update.trainingError;
    }
    if (update.status === 'completed' && update.trainingError === undefined) {
      analysisUpdates.trainingError = null;
    }

    updateAnalysisTraining(update.analysisId, analysisUpdates);

    if (update.status === 'running') {
      setDashboardLoading({
        kind: 'model-training',
        title: 'Training model',
        detail: update.detail || 'Please wait while the model is being trained.',
      });
    } else {
      setDashboardLoading((current) =>
        current?.kind === 'model-training' ? null : current
      );
    }

    setTrainingBanner({
      analysisId: update.analysisId,
      status: update.status,
      tone: update.tone,
      message: update.message,
      detail: update.detail,
    });
  };

  const upsertDataset = (dataset: Dataset) => {
    setExistingDatasets((prev) => {
      const index = prev.findIndex((item) => item.id === dataset.id);
      if (index === -1) {
        return [dataset, ...prev];
      }

      const next = [...prev];
      next[index] = dataset;
      return next;
    });
  };

  const fetchDatasetById = async (datasetId: string): Promise<Dataset | null> => {
    try {
      const rawDataset = await fetchDatasetByIdService(datasetId);
      const parsed = toDataset(rawDataset);
      upsertDataset(parsed);
      return parsed;
    } catch (error) {
      console.error('Error fetching dataset details:', error);
      return null;
    }
  };

  const openFeatureConfigForDataset = (dataset: Dataset) => {
    setPendingDataset({
      id: dataset.id,
      numRows: dataset.numRows,
      columnNames: dataset.columnNames,
      columns: dataset.columns ?? [],
      name: dataset.name,
      uploadAt: dataset.uploadAt,
      source: 'existing',
    });
    setCounterfactualEntrySource(null);
    setAnalysisStep('feature-config');
    setExistingDatasetModalOpen(false);
  };

  const openCounterfactualInputForAnalysis = (analysis: Analysis, dataset: Dataset) => {
    setPendingDataset({
      id: dataset.id,
      numRows: dataset.numRows,
      columnNames: dataset.columnNames,
      columns: dataset.columns ?? [],
      name: dataset.name,
      uploadAt: dataset.uploadAt,
      source: 'existing',
    });
    setPendingConfig({
      targetFeature: analysis.targetFeature,
      frozenFeatures: analysis.frozenFeatures,
    });
    setCounterfactualEntrySource('existing-analysis');
    setAnalysisStep('counterfactual-config');
  };

  /** Reset all pending flow state and go back to the normal view. */
  const clearPendingFlow = () => {
    setPendingDataset(null);
    setPendingConfig(null);
    setCounterfactualEntrySource(null);
    setAnalysisStep(null);
  };

  const isLandingView = activeAnalysis === null && analysisStep === null && !pendingDataset;

  const handleStartNewAnalysis = () => {
    if (!isLandingView) {
      clearPendingFlow();
      setActiveAnalysis(null);
    }
    setUploadModalOpen(false);
    setExistingDatasetModalOpen(false);
  };

  // -- Handlers -------------------------------------------------------------

  const handleSelectAnalysis = (analysisId: string) => {
    clearPendingFlow();
    setActiveAnalysis(analysisId);
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/analyses/${analysisId}/`, {
        method: 'DELETE',
        headers: {
          ...authHeaders(),
        },
      });
      if (!response.ok) throw new Error('Delete failed');

      const updatedAnalyses = analyses.filter((a) => a.id !== analysisId);
      setAnalyses(updatedAnalyses);
      if (activeAnalysis === analysisId) {
        setActiveAnalysis(updatedAnalyses.length > 0 ? updatedAnalyses[0].id : null);
      }
    } catch (err) {
      console.error('Error deleting analysis:', err);
    }
  };

  const handleUploadDataset = async (file: File) => {
    const datasetName = file.name.split('_')[0].split('.')[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', datasetName); // send it to backend

    setDashboardLoading({
      kind: 'dataset-upload',
      title: 'Uploading dataset',
      detail: 'Uploading file and preparing dataset metadata...',
    });

    try {
      const response = await fetch('http://localhost:8000/api/v1/datasets/', {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text(); // See server error message
        throw new Error(`Upload failed: ${errText}`);
      }

      const uploadedDataset = await response.json();

      setDashboardLoading({
        kind: 'dataset-upload',
        title: 'Processing dataset',
        detail: 'Cleaning rows and extracting feature statistics...',
      });

      await fetch(`http://localhost:8000/api/v1/datasets/${uploadedDataset.id}/process/`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
      });

      setDashboardLoading({
        kind: 'dataset-upload',
        title: 'Finalizing dataset',
        detail: 'Loading processed dataset into the analysis flow...',
      });

      const fullDatasetRes = await fetch(`http://localhost:8000/api/v1/datasets/${uploadedDataset.id}/`, {
        headers: {
          ...authHeaders(),
        },
      });
      const fullDataset = await fullDatasetRes.json();
      const parsedDataset = toDataset(fullDataset);

      console.log('Uploaded dataset:', fullDataset);

      upsertDataset(parsedDataset);

      setPendingDataset({
        id: parsedDataset.id,
        numRows: parsedDataset.numRows,
        columnNames: parsedDataset.columnNames,
        columns: parsedDataset.columns,
        name: parsedDataset.name,
        uploadAt: parsedDataset.uploadAt,
        source: 'upload',
      });
      setCounterfactualEntrySource(null);
      setAnalysisStep('feature-config');
      setUploadModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setDashboardLoading((current) =>
        current?.kind === 'dataset-upload' ? null : current
      );
    }
  };

  const handleChooseExisting = () => {
    setUploadModalOpen(false);
    setExistingDatasetModalOpen(true);
  };

  const handleSelectDataset = (datasetId: string) => {
    const dataset = existingDatasets.find((d) => d.id === datasetId);
    console.log('Selected dataset:', dataset);
    if (dataset && dataset.columnNames.length > 0 && dataset.columns.length > 0) {
      openFeatureConfigForDataset(dataset);
      return;
    }

    void (async () => {
      const fetchedDataset = await fetchDatasetById(datasetId);
      if (!fetchedDataset) return;
      openFeatureConfigForDataset(fetchedDataset);
    })();
  };

  /** Called when user clicks "Start Analysis" in FeatureConfigForm. */
  const handleFeatureConfigConfirm = (
    config: { targetFeature: string; frozenFeatures: string[] },
    createdAnalysis: AnalysisCreateResponse
  ) => {
    const datasetSnapshot = pendingDataset;
    if (!datasetSnapshot) {
      console.error('Cannot continue analysis flow without pending dataset metadata.');
      clearPendingFlow();
      return;
    }

    const persistedAnalysisId =
      createdAnalysis?.id != null ? String(createdAnalysis.id) : Date.now().toString();
    const persistedDatasetId =
      createdAnalysis?.dataset != null ? String(createdAnalysis.dataset) : datasetSnapshot.id;
    const nextTargetFeature = createdAnalysis?.target_feature || config.targetFeature;
    const nextFrozenFeatures = createdAnalysis?.frozen_features || config.frozenFeatures;

    setPendingConfig({
      targetFeature: nextTargetFeature,
      frozenFeatures: nextFrozenFeatures,
    });
    setCounterfactualEntrySource('new-analysis');
    setAnalysisStep('counterfactual-config');
    
    const newAnalysis: Analysis = {
      id: persistedAnalysisId,
      datasetId: persistedDatasetId,
      datasetName: createdAnalysis?.dataset_name || datasetSnapshot.name,
      modelName: 'XGBoost Classifier',
      targetFeature: nextTargetFeature,
      frozenFeatures: nextFrozenFeatures,
      testAnalyses: [],
      createdAt: createdAnalysis?.created_at ? new Date(createdAnalysis.created_at) : new Date(),
      trainingStatus: 'running',
      trainingModelId: null,
      trainingMetrics: null,
      trainingFeatureImportance: null,
      trainingError: null,
    };
    setAnalyses((prev) => [newAnalysis, ...prev]);
    setActiveAnalysis(newAnalysis.id);
  };

  // Build the UI run record by combining submitted config with the prediction payload from form.
  const buildCounterfactualRun = (
    analysis: Analysis,
    prediction: PredictionSubmissionPayload
  ): TestAnalysis => {
    const runNumber = (analysis.testAnalyses?.length ?? 0) + 1;

    const shapSummary = prediction.predictionError
      ? `Prediction and SHAP request failed: ${prediction.predictionError}`
      : prediction.shapTopFeatures.length > 0
      ? 'SHAP explanation generated from backend prediction endpoint.'
      : 'Prediction completed but SHAP feature importance was unavailable for this run.';

    const llmSummary = prediction.predictionError
      ? `Prediction failed for run #${runNumber}. Backend returned an error before counterfactual generation.\n\nError: ${prediction.predictionError}`
      : prediction.llmSummary || `Prediction completed for run #${runNumber}. Predicted class: ${prediction.predictionResult?.prediction_class ?? 'N/A'}${
          prediction.topConfidence !== null
            ? ` (top confidence ${(prediction.topConfidence * 100).toFixed(1)}%)`
            : ''
        }. No LLM summary was returned.`;

    // DiCE section is now populated from backend counterfactual response payload.
    return {
      testId: runNumber.toString(),
      timestamp: new Date(),
      inputData: prediction.predictionInput,
      predictionId:
        typeof prediction.predictionResult?.prediction_id === 'number'
          ? prediction.predictionResult.prediction_id
          : null,
      predictionClass:
        typeof prediction.predictionResult?.prediction_class === 'string'
          ? prediction.predictionResult.prediction_class
          : null,
      predictionValue:
        typeof prediction.predictionResult?.prediction_value === 'number'
          ? prediction.predictionResult.prediction_value
          : null,
      predictionProbabilities:
        prediction.predictionResult?.prediction_probabilities &&
        typeof prediction.predictionResult.prediction_probabilities === 'object'
          ? prediction.predictionResult.prediction_probabilities
          : null,
      predictionError: prediction.predictionError,
      llmSummary,
      shapAnalysis: {
        summary: shapSummary,
        topFeatures: prediction.shapTopFeatures,
      },
      diceAnalysis: {
        summary: prediction.counterfactualSummary,
        combinations: prediction.counterfactualCombinations,
      },
    };
  };

  /** Called when user clicks "Generate Counterfactuals" in CounterfactualConfigForm. */
  const handleCounterfactualConfigSubmit = (
    _config: CounterfactualConfig,
    prediction: PredictionSubmissionPayload
  ) => {
    if (!activeAnalysis) {
      clearPendingFlow();
      return;
    }

    const analysisSnapshot = analyses.find((analysis) => analysis.id === activeAnalysis);
    if (!analysisSnapshot) {
      clearPendingFlow();
      return;
    }

    setAnalyses((prev) =>
      prev.map((analysis) => {
        if (analysis.id !== activeAnalysis) return analysis;
        const run = buildCounterfactualRun(analysis, prediction);
        return {
          ...analysis,
          testAnalyses: [run, ...analysis.testAnalyses],
        };
      })
    );

    clearPendingFlow();
  };

  // Keep prediction loading overlay managed in Dashboard while API call stays in form layer.
  const handlePredictionRequestStateChange = (isRunning: boolean) => {
    if (isRunning) {
      setDashboardLoading({
        kind: 'prediction',
        title: 'Running prediction',
        detail: 'Generating prediction and SHAP explanation for this input...',
      });
      return;
    }

    setDashboardLoading((current) =>
      current?.kind === 'prediction' ? null : current
    );
  };

  const handleOpenCounterfactualInputForm = () => {
    if (!currentAnalysis) return;

    const analysis = currentAnalysis;
    if (!analysis.datasetId) {
      console.error('Analysis is missing dataset id:', analysis.id);
      alert('This analysis is missing dataset metadata. Please create a new analysis from a dataset first.');
      return;
    }

    const dataset = existingDatasets.find((d) => d.id === analysis.datasetId);

    if (dataset && dataset.columnNames.length > 0 && dataset.columns.length > 0) {
      openCounterfactualInputForAnalysis(analysis, dataset);
      return;
    }

    void (async () => {
      const fetchedDataset = await fetchDatasetById(analysis.datasetId);
      if (!fetchedDataset) {
        console.error('Unable to find dataset metadata for analysis:', analysis.id);
        alert('Could not load dataset metadata for this analysis. Please choose a dataset and start a new analysis.');
        return;
      }
      openCounterfactualInputForAnalysis(analysis, fetchedDataset);
    })();
  };

  const handleCounterfactualBack = () => {
    clearPendingFlow();
  };

  // -------------------------------------------------------------------------

  const renderMainContent = () => {
    // Step 1 - feature config
    if (analysisStep === 'feature-config' && pendingDataset) {
      const targetFeature = pendingDataset.columns.find((c: any) => c.is_target)?.name ?? '';
      return (
        <FeatureConfigForm
          datasetName={pendingDataset.name}
          datasetId={pendingDataset.id}
          features={pendingDataset.columnNames}
          datasetColumns={pendingDataset.columns}
          targetFeature={targetFeature}
          onConfirm={handleFeatureConfigConfirm}
          onTrainingUpdate={handleTrainingUpdate}
        />
      );
    } 

    // Step 2 - counterfactual outcome + instance values
    if (analysisStep === 'counterfactual-config' && pendingDataset && pendingConfig) {
      console.log('Configuring counterfactuals with dataset:', pendingDataset);
      const featureMetas = pendingDataset.columns.map((col) => ({
        name: col.name,
        type: col.data_type as  'continuous' | 'categorical',
        possibleValues: col.data_type === 'categorical' ? col.unique_values || [] : undefined,
      }));

      return (
        <CounterfactualConfigForm
          datasetName={pendingDataset.name}
          targetFeature={pendingConfig.targetFeature}
          frozenFeatures={pendingConfig.frozenFeatures}
          modelId={currentAnalysis?.trainingModelId ?? null}
          featureMetas={featureMetas}
          canReturnToAnalysis={Boolean(currentAnalysis && currentAnalysis.testAnalyses.length > 0)}
          onBack={handleCounterfactualBack}
          onPredictionRequestStateChange={handlePredictionRequestStateChange}
          onSubmit={handleCounterfactualConfigSubmit}
        />
      );
    }

    // Analysis selected - show output page
    if (currentAnalysis) {
      return (
        <AnalysisPanel
          datasetName={currentAnalysis.datasetName}
          modelName={currentAnalysis.modelName}
          targetFeature={currentAnalysis.targetFeature}
          frozenFeatures={currentAnalysis.frozenFeatures}
          trainingStatus={currentAnalysis.trainingStatus}
          trainingModelId={currentAnalysis.trainingModelId}
          trainingMetrics={currentAnalysis.trainingMetrics}
          trainingFeatureImportance={currentAnalysis.trainingFeatureImportance}
          trainingError={currentAnalysis.trainingError}
          analyses={currentAnalysis.testAnalyses}
          onOpenInputForm={handleOpenCounterfactualInputForm}
        />
      );
    }

    // Normal states
    return <EmptyAnalysisState onOpenUpload={() => setUploadModalOpen(true)} />;
  };

  // -------------------------------------------------------------------------

  return (
    <div className="h-dvh w-full flex bg-black text-white overflow-hidden relative">
      {sidebarOpen && (
        <AnalysisSidebar
          analyses={analyses}
          activeAnalysis={activeAnalysis}
          onSelectAnalysis={handleSelectAnalysis}
          onDeleteAnalysis={handleDeleteAnalysis}
          onToggleSidebar={() => setSidebarOpen(false)}
          onOpenProfile={() => setProfileModalOpen(true)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <PanelLeft className="w-5 h-5 text-white/70" />
                </button>
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <User className="w-5 h-5 text-white/70" />
                </button>
              </>
            )}
            <h2 className="text-lg font-medium text-white/90">
              {analysisStep === 'feature-config' && pendingDataset
                ? pendingDataset.name
                : analysisStep === 'counterfactual-config' && pendingDataset
                ? pendingDataset.name
                : currentAnalysis?.datasetName || 'Counterfactual Generation Tool'}
            </h2>
          </div>

          <button
            onClick={handleStartNewAnalysis}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Analysis</span>
          </button>
        </div>

        {trainingBanner && (
          <div
            className={`mx-3 mt-3 rounded-lg border px-4 py-3 flex items-start justify-between gap-3 ${
              trainingBanner.tone === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                : trainingBanner.tone === 'error'
                ? 'bg-red-500/10 border-red-500/40 text-red-200'
                : 'bg-blue-500/10 border-blue-500/40 text-blue-200'
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {trainingBanner.status === 'running' ? 'Training in progress' : trainingBanner.message}
              </p>
              <p className="text-sm opacity-90 truncate">{trainingBanner.detail}</p>
            </div>
            <button
              onClick={() => setTrainingBanner(null)}
              className="text-xs uppercase tracking-wide opacity-80 hover:opacity-100 transition-opacity"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        {renderMainContent()}
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadDataset={handleUploadDataset}
        onChooseExisting={handleChooseExisting}
      />

      <ExistingDatasetModal
        isOpen={existingDatasetModalOpen}
        onClose={() => setExistingDatasetModalOpen(false)}
        datasets={existingDatasets}
        onSelectDataset={handleSelectDataset}
      />

      {user && (
        <UserProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          user={user}
        />
      )}

      {dashboardLoading && (
        <LoadingOverlay title={dashboardLoading.title} detail={dashboardLoading.detail} />
      )}
    </div>
  );
}