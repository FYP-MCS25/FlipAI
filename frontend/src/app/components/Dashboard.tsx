import { useEffect, useState } from 'react';
import { AnalysisSidebar } from './AnalysisSidebar';
import { AnalysisOutput } from './AnalysisOutput';
import { EmptyAnalysisState } from './EmptyAnalysisState';
import { UploadModal } from './UploadModal';
import { ExistingDatasetModal } from './ExistingDatasetModal';
import { FeatureConfigForm } from './FeatureConfigForm';
import { CounterfactualConfigForm, FeatureMeta, CounterfactualConfig } from './CounterfactualConfigForm';
import { UserProfileModal } from './UserProfileModal';
import { PanelLeft, Plus, User } from 'lucide-react';

interface Analysis {
  id: string;
  datasetName: string;
  modelName: string;
  timestamp: Date;
  data: {
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
  };
}

interface Dataset {
  id: string;
  name: string;
  uploadDate: Date;
  rowCount: number;
  features?: string[];
  // column_types from API: maps column name → dtype string e.g. 'int64', 'float64', 'object'
  featureTypes?: Record<string, string>;
}

// ─── Step tracking for the multi-step new-analysis flow ───────────────────────
//
//  null                   → no pending analysis (show existing or empty state)
//  'feature-config'       → FeatureConfigForm  (pick target + frozen features)
//  'counterfactual-config'→ CounterfactualConfigForm (outcome condition + instance values)
//
type AnalysisStep = 'feature-config' | 'counterfactual-config';

interface PendingDataset {
  name: string;
  features: string[];      // plain column names list
  featureMetas: FeatureMeta[]; // enriched with type info from API
  source: 'upload' | 'existing';
  file?: File;
}

interface PendingConfig {
  targetFeature: string;
  frozenFeatures: string[];
}

export function Dashboard() {
  // TODO(api): Replace this seeded analysis history with data loaded from backend storage.
  const [analyses, setAnalyses] = useState<Analysis[]>([
    {
      id: '1',
      datasetName: 'customer_churn.csv',
      modelName: 'RandomForest',
      timestamp: new Date('2026-03-10T14:30:00'),
      data: {
        datasetName: 'customer_churn.csv',
        modelName: 'RandomForest Classifier',
        llmSummary: `Based on the analysis of your customer churn prediction model, several key insights emerge:

The model shows strong predictive performance with an accuracy of 87.3%. The SHAP analysis reveals that customer tenure, monthly charges, and contract type are the most influential factors in determining churn likelihood.

Interestingly, customers with month-to-month contracts show significantly higher churn rates compared to those with longer-term commitments. The counterfactual analysis suggests that converting high-risk customers to annual contracts could reduce churn probability by up to 45%.

Additional factors such as the presence of tech support and online security services also play important roles in customer retention. The model indicates that improving service quality in these areas could substantially decrease churn rates.`,
        shapAnalysis: {
          summary: "SHAP (SHapley Additive exPlanations) values show the contribution of each feature to the model's predictions. Higher values indicate stronger influence on the prediction outcome.",
          topFeatures: [
            { name: 'Tenure (months)', importance: 0.92 },
            { name: 'Monthly Charges', importance: 0.78 },
            { name: 'Contract Type', importance: 0.65 },
            { name: 'Tech Support', importance: 0.51 },
            { name: 'Online Security', importance: 0.43 },
          ],
        },
        diceAnalysis: {
          summary: 'DiCE-ML generates diverse counterfactual explanations showing minimal changes needed to alter the prediction outcome. These suggestions can help identify actionable interventions.',
          counterfactuals: [
            { feature: 'Contract Type', original: 'Month-to-Month', suggested: 'One Year' },
            { feature: 'Monthly Charges', original: '$85.50', suggested: '$65.00' },
            { feature: 'Tech Support', original: 'No', suggested: 'Yes' },
            { feature: 'Online Security', original: 'No', suggested: 'Yes' },
          ],
        },
      },
    },
    {
      id: '2',
      datasetName: 'loan_approval.csv',
      modelName: 'XGBoost',
      timestamp: new Date('2026-03-09T10:15:00'),
      data: {
        datasetName: 'loan_approval.csv',
        modelName: 'XGBoost Classifier',
        llmSummary: `The loan approval prediction model demonstrates robust performance with key insights into approval factors:

Credit score emerges as the dominant predictor, followed by debt-to-income ratio and employment history. The model achieves 91.2% accuracy in predicting loan approval outcomes.

The counterfactual analysis reveals actionable steps for applicants: improving credit score by 50 points or reducing debt-to-income ratio by 10% significantly increases approval probability.`,
        shapAnalysis: {
          summary: 'Feature importance analysis for loan approval predictions.',
          topFeatures: [
            { name: 'Credit Score', importance: 0.95 },
            { name: 'Debt-to-Income Ratio', importance: 0.82 },
            { name: 'Employment Length', importance: 0.71 },
            { name: 'Annual Income', importance: 0.63 },
          ],
        },
        diceAnalysis: {
          summary: 'Counterfactual suggestions for improving loan approval chances.',
          counterfactuals: [
            { feature: 'Credit Score', original: '650', suggested: '700' },
            { feature: 'Debt-to-Income', original: '45%', suggested: '35%' },
          ],
        },
      },
    },
  ]);

  // TODO(api): Replace with datasets fetched for the signed-in user from backend/database.
  const [existingDatasets, setExistingDatasets] = useState<Dataset[]>([]);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/datasets/');
        if (!res.ok) throw new Error('Failed to fetch datasets');
        const data = await res.json();
        const datasets: Dataset[] = data.results.map((d: any) => ({
          id: d.id.toString(),
          name: d.name,
          uploadDate: new Date(d.uploaded_at),
          rowCount: d.num_rows,
          features: d.column_names,
          featureTypes: d.column_types, // e.g. { age: 'int64', income: 'float64', gender: 'object' }
        }));
        setExistingDatasets(datasets);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDatasets();
  }, []);

  const [activeAnalysis, setActiveAnalysis] = useState<string | null>('1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [existingDatasetModalOpen, setExistingDatasetModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // ── Multi-step flow state ──
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [pendingDataset, setPendingDataset] = useState<PendingDataset | null>(null);
  const [pendingConfig, setPendingConfig] = useState<PendingConfig | null>(null);

  // TODO(auth): Replace with authenticated user profile returned by auth/session API.
  const [user] = useState({ name: 'John Doe', email: 'john.doe@example.com' });

  const currentAnalysis = analyses.find((a) => a.id === activeAnalysis);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Reset all pending flow state and go back to the normal view. */
  const clearPendingFlow = () => {
    setPendingDataset(null);
    setPendingConfig(null);
    setAnalysisStep(null);
  };

  /**
   * Build FeatureMeta array from column names + the column_types map returned by the API.
   *
   * API dtype strings (pandas convention) are mapped as:
   *   int8 / int16 / int32 / int64  → 'integer'
   *   float32 / float64             → 'float'
   *   object / string / category    → 'string'
   *
   * Falls back to 'integer' for any unrecognised dtype so the UI never breaks.
   */
  const buildFeatureMetas = (
    featureNames: string[],
    columnTypes?: Record<string, string>,  // { col_name: 'int64' | 'float64' | 'object' | ... }
    columnValues?: Record<string, string[]>, // optional { col_name: ['val1', 'val2'] } for string cols
  ): FeatureMeta[] => {
    return featureNames.map((name) => {
      const raw = columnTypes?.[name]?.toLowerCase() ?? '';
      const type: FeatureMeta['type'] =
        raw.startsWith('int')
          ? 'integer'
          : raw.startsWith('float')
          ? 'float'
          : raw === 'str'
          ? 'string'
          : 'string'; // safe fallback

      return {
        name,
        type,
        possibleValues: type === 'string' ? (columnValues?.[name] ?? []) : undefined,
      };
    });
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectAnalysis = (analysisId: string) => {
    clearPendingFlow();
    setActiveAnalysis(analysisId);
  };

  const handleDeleteAnalysis = (analysisId: string) => {
    setAnalyses(analyses.filter((a) => a.id !== analysisId));
    if (activeAnalysis === analysisId) {
      setActiveAnalysis(analyses.length > 1 ? analyses[0].id : null);
    }
  };

  const handleUploadDataset = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('http://localhost:8000/api/v1/datasets/', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const dataset = await response.json();
      const featureNames: string[] = dataset.column_names || [];
      console.log('Uploaded dataset:', dataset);
      setPendingDataset({
        name: dataset.name,
        features: featureNames,
        featureMetas: buildFeatureMetas(featureNames, dataset.column_types, dataset.column_values),
        source: 'upload',
      });
      setAnalysisStep('feature-config');
      setUploadModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChooseExisting = () => {
    setUploadModalOpen(false);
    setExistingDatasetModalOpen(true);
  };

  const handleSelectDataset = (datasetId: string) => {
    const dataset = existingDatasets.find((d) => d.id === datasetId);
    if (dataset) {
      const featureNames = dataset.features || ['Feature_1', 'Feature_2', 'Feature_3'];
      setPendingDataset({
        name: dataset.name,
        features: featureNames,
        // featureTypes stored from API: { col_name: 'int64' | 'float64' | 'object' | ... }
        featureMetas: buildFeatureMetas(featureNames, dataset.featureTypes),
        source: 'existing',
      });
      setAnalysisStep('feature-config');
      setExistingDatasetModalOpen(false);
    }
  };

  /** Called when user clicks "Start Analysis" in FeatureConfigForm. */
  const handleFeatureConfigConfirm = (config: { targetFeature: string; frozenFeatures: string[] }) => {
    setPendingConfig(config);
    setAnalysisStep('counterfactual-config');
  };

  /** Called when user clicks "Generate Counterfactuals" in CounterfactualConfigForm. */
  const handleCounterfactualConfigSubmit = (cfConfig: CounterfactualConfig) => {
    if (!pendingDataset || !pendingConfig) return;

    // TODO(api): Replace locally synthesized analysis payload with a real backend job submission.
    //            Pass cfConfig.targetCondition + cfConfig.instanceValues to your model service.
    const { targetFeature, frozenFeatures } = pendingConfig;
    const { targetCondition, instanceValues } = cfConfig;

    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      datasetName: pendingDataset.name,
      modelName: 'AutoML',
      timestamp: new Date(),
      data: {
        datasetName: pendingDataset.name,
        modelName: 'AutoML Classifier',
        llmSummary: `Analysis for **${pendingDataset.name}** is being processed.\n\n**Configuration:**\n- Target Feature: ${targetFeature}\n- Outcome Condition: ${targetCondition.feature} ${targetCondition.op} ${targetCondition.value}\n- Frozen Features: ${frozenFeatures.length > 0 ? frozenFeatures.join(', ') : 'None'}\n\nThe system will analyze feature importance using SHAP and generate counterfactual explanations with DiCE-ML. Frozen features remain constant; all other features are optimized to flip the prediction toward the specified condition.`,
        shapAnalysis: {
          // TODO(model): Replace with real SHAP values from backend explainability service.
          summary: `Feature importance analysis for predicting ${targetFeature}. SHAP values show how each feature contributes to the model's predictions.`,
          topFeatures: pendingDataset.features
            .filter((f) => f !== targetFeature)
            .slice(0, 5)
            .map((f, i) => ({ name: f, importance: 0.95 - i * 0.1 })),
        },
        diceAnalysis: {
          // TODO(model): Replace with real DiCE counterfactuals from backend service.
          summary: `Counterfactual explanations showing minimal changes needed so that ${targetCondition.feature} ${targetCondition.op} ${targetCondition.value}. ${frozenFeatures.length > 0 ? `Features kept constant: ${frozenFeatures.join(', ')}.` : 'All features are allowed to vary.'}`,
          counterfactuals: pendingDataset.features
            .filter((f) => f !== targetFeature && !frozenFeatures.includes(f))
            .slice(0, 4)
            .map((f) => ({
              feature: f,
              original: instanceValues[f] ?? 'Current Value',
              suggested: 'Suggested Value',
            })),
        },
      },
    };

    setAnalyses([newAnalysis, ...analyses]);
    setActiveAnalysis(newAnalysis.id);
    clearPendingFlow();
  };

  // ─────────────────────────────────────────────────────────────────────────

  const renderMainContent = () => {
    // Step 1 — feature config
    if (analysisStep === 'feature-config' && pendingDataset) {
      return (
        <FeatureConfigForm
          datasetName={pendingDataset.name}
          modelName="AutoML Classifier"
          features={pendingDataset.features}
          onConfirm={handleFeatureConfigConfirm}
        />
      );
    }

    // Step 2 — counterfactual outcome + instance values
    if (analysisStep === 'counterfactual-config' && pendingDataset && pendingConfig) {
      return (
        <CounterfactualConfigForm
          datasetName={pendingDataset.name}
          targetFeature={pendingConfig.targetFeature}
          frozenFeatures={pendingConfig.frozenFeatures}
          featureMetas={pendingDataset.featureMetas}
          onBack={() => setAnalysisStep('feature-config')}
          onSubmit={handleCounterfactualConfigSubmit}
        />
      );
    }

    // Normal states
    if (currentAnalysis) return <AnalysisOutput analysis={currentAnalysis.data} />;
    return <EmptyAnalysisState onOpenUpload={() => setUploadModalOpen(true)} />;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh w-full flex bg-black text-white overflow-hidden">
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
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Analysis</span>
          </button>
        </div>

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

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
      />
    </div>
  );
}