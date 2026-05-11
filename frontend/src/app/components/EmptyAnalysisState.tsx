import { Upload, Database, FileBarChart } from 'lucide-react';

interface EmptyAnalysisStateProps {
  onOpenUpload: () => void;
}

export function EmptyAnalysisState({ onOpenUpload }: EmptyAnalysisStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex p-6 rounded-full bg-muted/40 mb-6">
          <FileBarChart className="w-16 h-16 text-muted-foreground" />
        </div>
        
        <h1 className="text-3xl font-semibold text-foreground mb-4">
          Counterfactual Generation Tool
        </h1>
        
        <p className="text-lg text-muted-foreground mb-8">
          Upload your dataset to generate AI-powered analysis with SHAP feature importance 
          and DiCE-ML counterfactual explanations
        </p>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Upload className="w-5 h-5" />
          Get Started
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          <div className="p-6 rounded-xl bg-muted/40 border border-border text-left">
            <div className="p-3 rounded-lg bg-blue-600/20 w-fit mb-4">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-foreground font-medium mb-2">Upload Dataset</h3>
            <p className="text-sm text-muted-foreground">
              Upload CSV files to analyze model predictions and feature importance
            </p>
          </div>

          <div className="p-6 rounded-xl bg-muted/40 border border-border text-left">
            <div className="p-3 rounded-lg bg-green-600/20 w-fit mb-4">
              <Database className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-foreground font-medium mb-2">Use Existing Data</h3>
            <p className="text-sm text-muted-foreground">
              Select from previously uploaded datasets for quick analysis
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
