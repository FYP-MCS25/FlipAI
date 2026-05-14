import { Lock, Search, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { LoadingOverlay } from './ui/loading-overlay';
import { useState, useMemo } from 'react';
import { getAccessToken } from '../../apiService';

interface FeatureConfigFormProps {
  datasetName: string;
  datasetId: string;
  features: string[];
  datasetColumns: DatasetColumnMeta[];
  // targetFeature: string;
  onConfirm: (
    config: { targetFeature: string; frozenFeatures: string[] },
    createdAnalysis: AnalysisCreateResponse,
    modelId: number
  ) => void;
  onTrainingUpdate: (update: TrainingUpdate) => void;
}

export interface DatasetColumnMeta {
  name: string;
  data_type: string;
  unique_values?: string[] | null;
}

export interface AnalysisCreateResponse {
  id: number;
  dataset: number;
  dataset_name?: string;
  target_feature?: string;
  frozen_features?: string[];
  created_at?: string;
  model?: number;
}

export interface TrainingUpdate {
  analysisId: string;
  status: 'running' | 'completed' | 'failed';
  tone: 'info' | 'success' | 'error';
  message: string;
  detail?: string;
  trainingModelId?: number | null;
  trainingMetrics?: Record<string, unknown> | null;
  trainingFeatureImportance?: unknown;
  trainingError?: string | null;
}

const FEATURES_PER_PAGE = 10;

const authHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export function FeatureConfigForm({
  datasetName,
  datasetId,
  features,
  datasetColumns,
  // targetFeature, // Commented out - now selected by user
  onConfirm,
  onTrainingUpdate,
}: FeatureConfigFormProps) {
  const [selectedTargetFeature, setSelectedTargetFeature] = useState<string>('');
  const [frozenFeatures, setFrozenFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Only categorical features are valid target features
  const categoricalFeatures = useMemo(
    () =>
      features.filter((f) => {
        const col = datasetColumns.find((c) => c.name === f);
        return col?.data_type === 'categorical';
      }),
    [features, datasetColumns]
  );

  // Exclude selected target from the selectable (freeze) list
  const selectableFeatures = useMemo(
    () => features.filter((f) => f !== selectedTargetFeature),
    [features, selectedTargetFeature]
  );

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return selectableFeatures;
    return selectableFeatures.filter((feature) =>
      feature.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectableFeatures, searchQuery]);

  const totalPages = Math.ceil(filteredFeatures.length / FEATURES_PER_PAGE);
  const startIndex = (currentPage - 1) * FEATURES_PER_PAGE;
  const currentFeatures = filteredFeatures.slice(startIndex, startIndex + FEATURES_PER_PAGE);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && filteredFeatures.length > 0) {
      const firstMatchIndex = selectableFeatures.findIndex((f) =>
        f.toLowerCase().includes(query.toLowerCase())
      );
      if (firstMatchIndex !== -1) {
        setCurrentPage(Math.floor(firstMatchIndex / FEATURES_PER_PAGE) + 1);
      }
    } else {
      setCurrentPage(1);
    }
  };

  const handleToggleFrozen = (feature: string) => {
    setFrozenFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  // When target changes, unfreeze it if it was frozen
  const handleTargetChange = (feature: string) => {
    setSelectedTargetFeature(feature);
    setFrozenFeatures((prev) => prev.filter((f) => f !== feature));
    setCurrentPage(1);
  };

  const buildTrainPayload = (analysisId: string) => ({
    model_name: `${datasetName}-analysis-${analysisId}`,
    model_type: 'xgboost',
    task_type: 'classification',
    dataset_id: Number(datasetId),
    target_column: selectedTargetFeature,
    feature_columns: selectableFeatures,
    train_test_split: 0.8,
  });

  const buildAnalysisPayload = (modelId: number) => {
    const featureList = features.filter(
      (f) => f !== selectedTargetFeature && !frozenFeatures.includes(f)
    );
    return {
      target_feature: selectedTargetFeature,
      frozen_features: frozenFeatures,
      dataset: Number(datasetId),
      model: modelId,
      analysis_name: datasetName,
      description: '',
      model_type: 'xgboost',
      feature_list: featureList,
      num_features: featureList.length,
      status: 'active',
      error_message: '',
    };
  };

  const handleApiError = (context: string, error: any, fallbackMsg = 'Unknown error') => {
    const msg = error?.error || error?.detail || (typeof error === 'string' ? error : fallbackMsg);
    console.error(`${context} failed:`, error);
    alert(`${context} failed. Check console.`);
    return msg;
  };

  const trainModelForAnalysis = async (analysisId: string): Promise<number | null> => {
    if (selectableFeatures.length === 0) {
      onTrainingUpdate({
        analysisId,
        status: 'failed',
        tone: 'error',
        message: 'Training failed to start.',
        detail: 'No feature columns are available after excluding the target feature.',
        trainingError: 'No feature columns are available after excluding the target feature.',
      });
      return null;
    }
    try {
      const response = await fetch('http://localhost:8000/api/v1/models/train/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(buildTrainPayload(analysisId)),
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = handleApiError('Training', responseData, 'Training request failed.');
        onTrainingUpdate({
          analysisId,
          status: 'failed',
          tone: 'error',
          message: 'Training failed.',
          detail: msg,
          trainingError: msg,
        });
        return null;
      }
      const modelId = typeof responseData?.model_id === 'number' ? responseData.model_id : null;
      onTrainingUpdate({
        analysisId,
        status: 'completed',
        tone: 'success',
        message: 'Training completed successfully.',
        detail: modelId ? `Model ID: ${modelId}` : 'Model output is ready to use.',
        trainingModelId: modelId,
        trainingMetrics:
          responseData?.metrics && typeof responseData.metrics === 'object'
            ? responseData.metrics
            : null,
        trainingFeatureImportance: responseData?.feature_importance ?? null,
        trainingError: null,
      });
      return modelId;
    } catch (error) {
      const msg = handleApiError('Training', error, 'Unknown training error.');
      onTrainingUpdate({
        analysisId,
        status: 'failed',
        tone: 'error',
        message: 'Training failed.',
        detail: msg,
        trainingError: msg,
      });
      return null;
    }
  };

  const handleConfirm = async () => {
    if (!selectedTargetFeature) {
      alert('Please select a target feature before starting the analysis.');
      return;
    }

    setIsLoading(true);
    try {
      const tempAnalysisId = Date.now().toString();
      const modelId = await trainModelForAnalysis(tempAnalysisId);

      if (!modelId) {
        onTrainingUpdate({
          analysisId: '',
          status: 'failed',
          tone: 'error',
          message: 'Training failed.',
          detail: 'Model training did not return a model ID.',
          trainingError: 'Model training did not return a model ID.',
        });
        return;
      }

      try {
        const analysisPayload = buildAnalysisPayload(modelId);
        const response = await fetch('http://localhost:8000/api/v1/analyses/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(analysisPayload),
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
          handleApiError('Analysis creation', responseData, 'Failed to create analysis.');
          return;
        }
        const analysisId = responseData?.id != null ? String(responseData.id) : Date.now().toString();
        onConfirm({ targetFeature: selectedTargetFeature, frozenFeatures }, responseData, modelId);
        onTrainingUpdate({
          analysisId,
          status: 'completed',
          tone: 'success',
          message: 'Training completed and analysis created.',
          detail: '',
          trainingModelId: modelId,
        });
      } catch (error) {
        const msg = handleApiError('Analysis creation', error, 'Unknown error');
        onTrainingUpdate({
          analysisId: '',
          status: 'failed',
          tone: 'error',
          message: 'Analysis creation failed.',
          detail: msg,
          trainingError: msg,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto relative">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{datasetName}</h1>
        </div>

        {/* Target Feature Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/25 dark:bg-amber-500/15">
              <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Target Feature</h2>
              <p className="text-xs text-muted-foreground">
                Select the categorical feature the model should predict.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/10 dark:bg-amber-600/10">
            <select
              value={selectedTargetFeature}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full bg-input-background dark:bg-input/30 border border-input rounded-lg px-3 py-2.5 text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:border-amber-500/60 transition-all"
            >
              <option value="" disabled className="text-muted-foreground">
                Select a categorical feature...
              </option>
              {categoricalFeatures.map((f) => (
                <option key={f} value={f} className="text-foreground bg-background">
                  {f}
                </option>
              ))}
            </select>

            {categoricalFeatures.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                No categorical features found in this dataset.
              </p>
            )}

            {selectedTargetFeature && (
              <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-2">
                Selected: <span className="font-mono font-semibold">{selectedTargetFeature}</span>
              </p>
            )}
          </div>
        </div>

        {/* Search + Legend */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-11 pr-4 py-3 bg-input-background dark:bg-input/30 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {searchQuery && (
            <p className="text-sm text-muted-foreground">
              Found {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
            </p>
          )}

          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border max-w-sm">
            <div className="p-2 rounded-lg bg-blue-500/25 dark:bg-blue-600/20 flex-shrink-0">
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">Frozen Features</h3>
              <p className="text-sm text-muted-foreground">
                Select features that should remain constant (optional)
              </p>
            </div>
          </div>
        </div>

        {/* Feature List */}
        {!selectedTargetFeature ? (
          <div className="bg-muted/40 rounded-xl border border-border text-center py-12 px-6">
            <Target className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground">Select a target feature above to configure frozen features.</p>
          </div>
        ) : filteredFeatures.length === 0 ? (
          <div className="bg-muted/40 rounded-xl border border-border text-center py-12 px-6">
            <Search className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground">No features found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="bg-muted/40 border border-border rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="flex items-center gap-4 p-4 bg-muted/40 border-b border-border">
              <div className="flex-1 text-sm font-medium text-muted-foreground">Feature Name</div>
              <div className="text-sm font-medium text-muted-foreground text-center w-20">
                <div className="flex items-center justify-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Freeze</span>
                </div>
              </div>
            </div>

            {/* Feature Rows */}
            <div className="divide-y divide-border/60">
              {currentFeatures.map((feature, index) => {
                const globalIndex = startIndex + index + 1;
                const isFrozen = frozenFeatures.includes(feature);

                return (
                  <div
                    key={feature}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-sm text-muted-foreground flex-shrink-0">
                        {globalIndex}
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </div>
                    <div className="flex items-center justify-center w-20">
                      <input
                        type="checkbox"
                        checked={isFrozen}
                        onChange={() => handleToggleFrozen(feature)}
                        className="w-5 h-5 rounded border-input bg-input-background dark:bg-input/30 text-blue-600 accent-blue-600 checked:bg-blue-600 checked:border-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {filteredFeatures.length > FEATURES_PER_PAGE && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-muted/40 hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-lg">
              <span className="text-foreground font-medium">{currentPage}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-muted/40 hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}

        {/* Action Section */}
        <div className="p-4 border border-border rounded-xl bg-muted/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
              {frozenFeatures.length > 0 && (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  <span>
                    {frozenFeatures.length} frozen feature{frozenFeatures.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {!selectedTargetFeature && (
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-600 dark:text-amber-400">No target feature selected</span>
                </div>
              )}
            </div>
            <button
              onClick={handleConfirm}
              className="w-full md:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={isLoading || !selectedTargetFeature}
            >
              Start Analysis
            </button>
          </div>
        </div>
      </div>
      {isLoading && (
        <LoadingOverlay title="Starting analysis" detail="Training model and creating analysis..." />
      )}
    </div>
  );
}