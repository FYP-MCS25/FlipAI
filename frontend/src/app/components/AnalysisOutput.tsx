import { Brain, BarChart3, Sparkles } from 'lucide-react';

interface AnalysisData {
  datasetName: string;
  modelName: string;
  llmSummary: string;
  shapAnalysis: {
    topFeatures: { name: string; importance: number }[];
    summary: string;
  };
  diceAnalysis: {
    counterfactuals: { feature: string; original: string; suggested: string }[];
    summary: string;
  };
}

interface AnalysisOutputProps {
  analysis: AnalysisData;
}

export function AnalysisOutput({ analysis }: AnalysisOutputProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {analysis.datasetName}
          </h1>
          <p className="text-muted-foreground">Model: {analysis.modelName}</p>
        </div>

        {/* LLM Summary */}
        <div className="bg-muted/40 rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-600/20">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">AI Analysis Summary</h2>
          </div>
          <p className="text-foreground leading-relaxed whitespace-pre-line">
            {analysis.llmSummary}
          </p>
        </div>

        {/* SHAP Analysis */}
        <div className="bg-muted/40 rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/25 dark:bg-blue-600/20">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">SHAP Analysis</h2>
          </div>
          
          <p className="text-foreground mb-6">{analysis.shapAnalysis.summary}</p>
          
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Top Feature Importance
            </h3>
            {analysis.shapAnalysis.topFeatures.map((feature, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{feature.name}</span>
                  <span className="text-muted-foreground">{(feature.importance * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                    style={{ width: `${feature.importance * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DiCE-ML Analysis */}
        <div className="bg-muted/40 rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/25 dark:bg-green-600/20">
              <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              DiCE-ML Counterfactual Analysis
            </h2>
          </div>
          
          <p className="text-foreground mb-6">{analysis.diceAnalysis.summary}</p>
          
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Suggested Counterfactuals
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Feature
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Current Value
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Suggested Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.diceAnalysis.counterfactuals.map((cf, index) => (
                    <tr key={index} className="border-b border-border/60">
                      <td className="py-3 px-4 text-foreground">{cf.feature}</td>
                      <td className="py-3 px-4 text-muted-foreground">{cf.original}</td>
                      <td className="py-3 px-4">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {cf.suggested}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
