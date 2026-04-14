import { useEffect, useState } from 'react';
import { FlaskConical, Upload } from 'lucide-react';
import { CollapsibleAnalysis, type TestAnalysis } from './CollapsibleAnalysis';

interface AnalysisPanelProps {
  datasetName: string;
  modelName: string;
  targetFeature: string;
  frozenFeatures: string[];
  analyses: TestAnalysis[];
  onOpenInputForm: () => void;
}

export function AnalysisPanel({
  datasetName,
  modelName,
  targetFeature,
  frozenFeatures,
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">{datasetName}</h1>
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

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Run Counterfactual on New Input</h2>
            <p className="text-sm text-white/60">
              Upload a one-row CSV test instance to generate another counterfactual explanation using the same target and frozen features.
            </p>
          </div>

          <button
            onClick={onOpenInputForm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium"
          >
            <Upload className="w-4 h-4" />
            Upload Entry
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
