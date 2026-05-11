import { useEffect, useState } from 'react';
import { FlaskConical, Upload, ArrowLeft } from 'lucide-react';
import { CollapsibleAnalysis, type TestAnalysis } from './CollapsibleAnalysis';

type TrainingStatus = 'running' | 'completed' | 'failed';

interface AnalysisPanelProps {
  datasetName: string;
  modelName: string;
  targetFeature: string;
  frozenFeatures: string[];
  trainingStatus: TrainingStatus;
  trainingModelId: number | null;
  trainingMetrics: Record<string, unknown> | null;
  trainingFeatureImportance: unknown;
  trainingError: string | null;
  analyses: TestAnalysis[];
  onOpenInputForm: () => void;
}

export function AnalysisPanel({
  datasetName,
  modelName,
  targetFeature,
  frozenFeatures,
  trainingStatus,
  trainingModelId,
  trainingMetrics,
  trainingFeatureImportance,
  trainingError,
  analyses,
  onOpenInputForm,
}: AnalysisPanelProps) {
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(
    analyses.length > 0 ? analyses[0].testId : null
  );

  useEffect(() => {
    if (analyses.length === 0) {
      setExpandedAnalysis(null);
      return;
    }

    const exists = analyses.some((analysis) => analysis.testId === expandedAnalysis);
    // Keep null as a valid "all collapsed" state; only recover from stale ids.
    if (!exists && expandedAnalysis !== null) {
      setExpandedAnalysis(analyses[0].testId);
    }
  }, [analyses, expandedAnalysis]);

  const handleToggle = (testId: string) => {
    setExpandedAnalysis((prev) => (prev === testId ? null : testId));
  };

  const statusOptions = {
    running: {
      label: 'Training',
      className: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
      description: 'Training is in progress. This may take a few minutes for SHAP-heavy models.',
    },
    completed: {
      label: 'Completed',
      className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
      description: 'Training completed and model output is ready.',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-500/20 text-red-300 border border-red-500/40',
      description: trainingError || 'Training failed. Check backend logs and request payload.',
    },
  };

  const statusMeta = statusOptions[trainingStatus as keyof typeof statusOptions] || statusOptions.completed;

  const preferredMetricKeys = [
    'train_accuracy',
    'test_accuracy',
    'train_r2',
    'test_r2',
    'best_round',
    'total_rounds',
  ];

  const metricEntries: Array<[string, unknown]> = [];
  if (trainingMetrics && typeof trainingMetrics === 'object') {
    const metricsObject = trainingMetrics as Record<string, unknown>;
    preferredMetricKeys.forEach((key) => {
      if (metricsObject[key] !== undefined && metricsObject[key] !== null) {
        metricEntries.push([key, metricsObject[key]]);
      }
    });

    if (metricEntries.length === 0) {
      Object.entries(metricsObject)
        .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
        .slice(0, 6)
        .forEach((entry) => metricEntries.push(entry));
    }
  }

  const formattedMetricValue = (key: string, value: unknown) => {
    if (typeof value !== 'number') return String(value);

    if (key.includes('accuracy') && value >= 0 && value <= 1) {
      return `${(value * 100).toFixed(2)}%`;
    }
    if (key.includes('r2')) {
      return value.toFixed(4);
    }
    if (Number.isInteger(value)) {
      return String(value);
    }

    return value.toFixed(4);
  };

  const featureImportanceMap =
    trainingFeatureImportance && typeof trainingFeatureImportance === 'object' && !Array.isArray(trainingFeatureImportance)
      ? (trainingFeatureImportance as Record<string, unknown>)
      : null;

  const topImportanceEntries = featureImportanceMap
    ? Object.entries(featureImportanceMap)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([feature, value]) => {
        let displayFeature = feature;
        if (displayFeature.includes('_')) {
          const parts = displayFeature.split('_');
          const root = parts[0];
          const val = parts.slice(1).join('_');
          displayFeature = `${root} (${val})`;
        }
        return [displayFeature, value] as [string, unknown];
      })
    : [];

  const importanceError =
    featureImportanceMap && typeof featureImportanceMap.error === 'string'
      ? featureImportanceMap.error
      : null;

  return (
    <div className="flex-1 overflow-y-auto relative">
      {/* Back button - sits at top-left, outside the centered content column */}
      <button
        onClick={onOpenInputForm}
        className="absolute top-6 left-6 z-10 p-1 text-white/70 hover:text-white transition-colors"
        title="Back"
      >
        <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-semibold text-white">{datasetName}</h1>
          </div>
          <p className="text-white/60">Model: {modelName}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm">
              Target: {targetFeature}
            </span>
            {frozenFeatures.length > 0 && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                Frozen: {frozenFeatures.join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Model Training Summary</h2>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>

          <p className="text-sm text-white/70">{statusMeta.description}</p>


          {metricEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {metricEntries.map(([key, value]) => (
                  <div key={key} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-white/60 uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-white font-medium">{formattedMetricValue(key, value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topImportanceEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Feature Importance (Top 5)</h3>
              <div className="space-y-2">
                {topImportanceEntries.map(([feature, value]) => (
                  <div key={feature} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/80 truncate">{feature}</span>
                      <span className="text-white/60">{Number(value).toFixed(4)}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, Number(value) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importanceError && (
            <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Feature importance note: {importanceError}
            </p>
          )}

          {trainingStatus === 'failed' && trainingError && (
            <p className="text-sm text-red-300/90 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              Error: {trainingError}
            </p>
          )}
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Run Counterfactual on New Input</h2>
            <p className="text-sm text-white/60">
              Upload a one-row CSV test instance to generate another counterfactual explanation using the same target and frozen features.
            </p>
          </div>

          <button
            onClick={onOpenInputForm}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full transition-all text-white font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Upload New Entry
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/90">
            <FlaskConical className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-semibold">Analysis History</h2>
          </div>

          {analyses.length === 0 ? (
            <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center text-white/50">
              No test runs yet. Upload a one-row CSV to generate your first counterfactual output.
            </div>
          ) : (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              {analyses.map((analysis) => (
                <CollapsibleAnalysis
                  key={analysis.testId}
                  analysis={analysis}
                  isExpanded={expandedAnalysis === analysis.testId}
                  onToggle={() => handleToggle(analysis.testId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
