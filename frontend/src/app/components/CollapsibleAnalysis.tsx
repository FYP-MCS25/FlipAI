import { useState } from 'react';
import { Brain, BarChart3, Sparkles, ChevronDown, ChevronUp, Info, ArrowRight } from 'lucide-react';

interface CounterfactualCombination {
  id: number;
  confidence?: number | null;
  combinedScore?: number | null;
  features: { name: string; value: string }[];
  explanation?: string;
}

export interface TestAnalysis {
  testId: string;
  timestamp: Date;
  inputData: Record<string, string | number>;
  predictionId?: number | null;
  predictionClass?: string | null;
  predictionValue?: number | null;
  predictionProbabilities?: Record<string, number> | null;
  predictionError?: string | null;
  llmSummary: string;
  shapAnalysis: {
    topFeatures: { name: string; importance: number }[];
    summary: string;
  };
  diceAnalysis: {
    combinations: CounterfactualCombination[];
    summary: string;
  };
}

interface CollapsibleAnalysisProps {
  analysis: TestAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
}

function CounterfactualCard({ combination, displayId }: { combination: CounterfactualCombination, displayId: number }) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="bg-muted/50 rounded-lg p-4 border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm">
        <p className="text-muted-foreground font-medium">Counterfactual #{displayId}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {combination.confidence !== null && combination.confidence !== undefined && (
            <span>Confidence: {(combination.confidence * 100).toFixed(1)}%</span>
          )}
        </div>
      </div>

      {combination.features.length === 0 ? (
        <p className="text-muted-foreground text-sm">No feature-change details were returned for this option.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {combination.features.map((feature, idx) => (
            <div key={idx} className="flex justify-between items-start text-sm gap-4 py-1">
              <span className="text-muted-foreground">{feature.name}</span>
              <span className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {feature.value.includes(' -> ') ? (
                  <>
                    <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-600 dark:text-red-300 font-medium">
                      {feature.value.split(' -> ')[0]}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 font-medium">
                      {feature.value.split(' -> ')[1]}
                    </span>
                  </>
                ) : (
                  <span className="text-foreground">{feature.value}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {combination.explanation && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Info className="w-4 h-4" />
            {showExplanation ? 'Hide Strategy Guide' : 'View Strategy Guide'}
          </button>
          
          {showExplanation && (
            <div className="mt-3 p-3 bg-blue-900/10 rounded-lg border border-blue-500/20">
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {combination.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CollapsibleAnalysis({ analysis, isExpanded, onToggle }: CollapsibleAnalysisProps) {
  const bestConfidence = analysis.predictionProbabilities
    ? (() => {
        const values = Object.values(analysis.predictionProbabilities || {}).filter(
          (value): value is number => typeof value === 'number' && Number.isFinite(value)
        );
        return values.length > 0 ? Math.max(...values) : null;
      })()
    : null;
    
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="text-left">
          <p className="text-foreground font-medium">Run #{analysis.testId}</p>
          <p className="text-muted-foreground text-sm">
            {analysis.timestamp.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-6 space-y-6">
          <div className="bg-muted/40 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Input Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(analysis.inputData).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm gap-4">
                  <span className="text-muted-foreground truncate">{key}</span>
                  <span className="text-foreground font-medium truncate">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Prediction Result</h3>

            {analysis.predictionError ? (
              <p className="text-sm text-red-700 dark:text-red-300/90">{analysis.predictionError}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  Predicted class: <span className="text-foreground font-medium">{analysis.predictionClass ?? 'N/A'}</span>
                </p>
                {analysis.predictionValue !== null && analysis.predictionValue !== undefined && (
                  <p className="text-muted-foreground">Raw prediction value: {analysis.predictionValue}</p>
                )}
                {bestConfidence !== null && (
                  <p className="text-muted-foreground">Top confidence: {(bestConfidence * 100).toFixed(1)}%</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-muted/40 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-600/20">
                <Brain className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="font-semibold text-foreground">AI Analysis Summary</h3>
            </div>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{analysis.llmSummary}</p>
          </div>

          <div className="bg-muted/40 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-600/20">
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="font-semibold text-foreground">SHAP Analysis</h3>
            </div>

            {analysis.shapAnalysis.topFeatures.length === 0 ? (
              <p className="text-muted-foreground text-sm">No SHAP feature importance data is available for this run.</p>
            ) : (
              <div className="space-y-4">
                {analysis.shapAnalysis.topFeatures.map((feature, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{feature.name}</span>
                      <span className="text-blue-600 dark:text-blue-300">{(feature.importance * 100).toFixed(1)}% Impact</span>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-blue-500/80 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${Math.max(0, Math.min(100, feature.importance * 100))}%` }}
                      />
                    </div>
                </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-muted/40 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-600/20">
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <h3 className="font-semibold text-foreground">DiCE-ML Counterfactual Combinations</h3>
            </div>

            <p className="text-foreground text-sm mb-4">{analysis.diceAnalysis.summary}</p>

            <div className="space-y-4">
              {analysis.diceAnalysis.combinations.map((combination, index) => (
                <CounterfactualCard key={combination.id} combination={combination} displayId={index + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
