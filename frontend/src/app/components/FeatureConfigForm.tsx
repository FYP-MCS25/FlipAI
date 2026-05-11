import { Lock, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingOverlay } from './ui/loading-overlay';
import { useState, useMemo } from 'react';

interface FeatureConfigFormProps {
  datasetName: string;
  datasetId: string;
  features: string[];
  datasetColumns: DatasetColumnMeta[];
  targetFeature: string; // Now passed in from parent
  onConfirm: (
    config: { targetFeature: string; frozenFeatures: string[] },
    createdAnalysis: AnalysisCreateResponse, // This is the response from the analysis creation API
    modelId: number // Pass the actual modelId that was trained
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

export function FeatureConfigForm({
  datasetName,
  datasetId,
  features,
  datasetColumns,
  targetFeature,
  onConfirm,
  onTrainingUpdate,
}: FeatureConfigFormProps) {
  const [frozenFeatures, setFrozenFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Exclude the target feature from the selectable list
  const selectableFeatures = useMemo(
    () => features.filter((f) => f !== targetFeature),
    [features, targetFeature]
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

  // --- Utility: Build model training payload ---
  const buildTrainPayload = (analysisId: string) => ({
    model_name: `${datasetName}-analysis-${analysisId}`,
    model_type: 'xgboost', // If dynamic, pass as param
    task_type: 'classification', // If dynamic, pass as param
    dataset_id: Number(datasetId),
    target_column: targetFeature,
    feature_columns: selectableFeatures,
    train_test_split: 0.8,
  });

  // --- Utility: Build analysis creation payload ---
  const buildAnalysisPayload = (modelId: number) => {
    const featureList = features.filter(
      (f) => f !== targetFeature && !frozenFeatures.includes(f)
    );
    return {
      target_feature: targetFeature,
      frozen_features: frozenFeatures,
      dataset: Number(datasetId),
      model: modelId,
      analysis_name: datasetName,
      description: "",
      model_type: "xgboost",
      feature_list: featureList,
      num_features: featureList.length,
      status: "active",
      error_message: "",
    };
  };

  // --- Utility: Handle API errors ---
  const handleApiError = (context: string, error: any, fallbackMsg = 'Unknown error') => {
    const msg = error?.error || error?.detail || (typeof error === 'string' ? error : fallbackMsg);
    console.error(`${context} failed:`, error);
    alert(`${context} failed. Check console.`);
    return msg;
  };

  // --- API: Train model ---
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
        headers: { 'Content-Type': 'application/json' },
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
    setIsLoading(true);
    try {
      // 1) Trigger model training using trainModelForAnalysis, then create analysis only if training succeeds
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

      // 2) Now create the analysis, including the modelId and all required fields
      try {
        const analysisPayload = buildAnalysisPayload(modelId);
        const response = await fetch('http://localhost:8000/api/v1/analyses/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analysisPayload),
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = handleApiError('Analysis creation', responseData, 'Failed to create analysis.');
          return;
        }
        const analysisId = responseData?.id != null ? String(responseData.id) : Date.now().toString();
        onConfirm({ targetFeature, frozenFeatures }, responseData, modelId); // Pass modelId here
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
          <h1 className="text-3xl font-semibold text-white">{datasetName}</h1>
        </div>

        {/* Target Feature Banner */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-600/10 border border-amber-500/20">
          <div className="p-2 rounded-lg bg-amber-600/20 flex-shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-amber-400/80 font-medium uppercase tracking-wide">
              Target Feature
            </p>
            <p className="text-white font-semibold text-lg">{targetFeature}</p>
            <p className="text-sm text-white/50 mt-0.5">
              Automatically detected from the dataset
            </p>
          </div>
        </div>

        {/* Search + Legend */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-white/40" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {searchQuery && (
            <p className="text-sm text-white/60">
              Found {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
            </p>
          )}

          <div className="flex items-start gap-3 p-4 rounded-lg bg-black/20 border border-white/10 max-w-sm">
            <div className="p-2 rounded-lg bg-blue-600/20 flex-shrink-0">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-medium mb-1">Frozen Features</h3>
              <p className="text-sm text-white/60">
                Select features that should remain constant (optional)
              </p>
            </div>
          </div>
        </div>

        {/* Feature List */}
        {filteredFeatures.length === 0 ? (
          <div className="bg-white/5 rounded-xl border border-white/10 text-center py-12 px-6">
            <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No features found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="flex items-center gap-4 p-4 bg-white/5 border-b border-white/10">
              <div className="flex-1 text-sm font-medium text-white/60">Feature Name</div>
              <div className="text-sm font-medium text-white/60 text-center w-20">
                <div className="flex items-center justify-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-400" />
                  <span>Freeze</span>
                </div>
              </div>
            </div>

            {/* Feature Rows */}
            <div className="divide-y divide-white/5">
              {currentFeatures.map((feature, index) => {
                const globalIndex = startIndex + index + 1;
                const isFrozen = frozenFeatures.includes(feature);

                return (
                  <div
                    key={feature}
                    className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm text-white/60 flex-shrink-0">
                        {globalIndex}
                      </div>
                      <span className="text-white">{feature}</span>
                    </div>
                    <div className="flex items-center justify-center w-20">
                      <input
                        type="checkbox"
                        checked={isFrozen}
                        onChange={() => handleToggleFrozen(feature)}
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
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
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
              <span className="text-white font-medium">{currentPage}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/60">{totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Action Section */}
        <div className="p-4 border border-white/10 rounded-xl bg-white/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 text-sm text-white/60 sm:flex-row sm:items-center sm:gap-6">
              {frozenFeatures.length > 0 && (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  <span>
                    {frozenFeatures.length} frozen feature{frozenFeatures.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleConfirm}
              className="w-full md:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
              disabled={isLoading}
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