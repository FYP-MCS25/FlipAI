import { useEffect, useState } from 'react';
import { AnalysisSidebar } from './AnalysisSidebar';
import { AnalysisOutput } from './AnalysisOutput';
import { EmptyAnalysisState } from './EmptyAnalysisState';
import { UploadModal } from './UploadModal';
import { ExistingDatasetModal } from './ExistingDatasetModal';
import { FeatureConfigForm } from './FeatureConfigForm';
import { CounterfactualConfigForm} from './Counterfactualconfigform';
import { UserProfileModal } from './UserProfileModal';
import { PanelLeft, Plus, User } from 'lucide-react';
import { data } from 'react-router';

interface Analysis {
  id: string;
  datasetId: string;  
  datasetName: string;
  targetFeature: string;
  frozenFeatures: string[];
  createdAt: Date;
}

interface Dataset {
  id: string;
  name: string;
  file?: File;
  uploadAt: Date;
  numRows: number;
  columnNames: string[];
  columnTypes: Record<string, string>;
}

// --- Step tracking for the multi-step new-analysis flow -----------------------
//
//  null                   -> no pending analysis (show existing or empty state)
//  'feature-config'       -> FeatureConfigForm  (pick target + frozen features)
//  'counterfactual-config'-> CounterfactualConfigForm (outcome condition + instance values)
//
type AnalysisStep = 'feature-config' | 'counterfactual-config';

interface PendingDataset {
  id: string;
  name: string;
  file?: File;
  uploadAt: Date;
  numRows: number;
  columnNames: string[];
  columnTypes: Record<string, string>;
  source: 'upload' | 'existing';
}

interface PendingConfig {
  targetFeature: string;
  frozenFeatures: string[];
}

export function Dashboard() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/analyses/');
        if (!res.ok) throw new Error('Failed to fetch analyses');
        const data = await res.json();
        // Transform API data into your Analysis type
        const loadedAnalyses: Analysis[] = data.results.map((a: any) => ({
          id: a.id.toString(),
          targetFeature: a.target_feature,
          frozenFeatures: a.frozen_features,
          datasetName: a.dataset_name,
          datasetId: a.dataset_id,       // make sure your API returns dataset_id
          createdAt: new Date(a.created_at),
        }));
        console.log('Loaded analyses:', loadedAnalyses);
        setAnalyses(loadedAnalyses);
        if (loadedAnalyses.length > 0) setActiveAnalysis(loadedAnalyses[0].id);
      } catch (err) {
        console.error('Error fetching analyses:', err);
      }
    };

    fetchAnalyses();
  }, []);

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
          uploadAt: new Date(d.uploaded_at),
          numRows: d.num_rows,
          columnNames: d.column_names,
          columnTypes: d.column_types,
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

  // -- Multi-step flow state --
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null);
  const [pendingDataset, setPendingDataset] = useState<PendingDataset | null>(null);
  const [pendingConfig, setPendingConfig] = useState<PendingConfig | null>(null);

  // TODO(auth): Replace with authenticated user profile returned by auth/session API.
  const [user] = useState({ name: 'John Doe', email: 'john.doe@example.com' });

  const currentAnalysis = analyses.find((a) => a.id === activeAnalysis);

  // -- Helpers ---------------------------------------------------------------

  /** Reset all pending flow state and go back to the normal view. */
  const clearPendingFlow = () => {
    setPendingDataset(null);
    setPendingConfig(null);
    setAnalysisStep(null);
  };

  // -- Handlers -------------------------------------------------------------

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
      console.log('Uploaded dataset:', dataset);
      setPendingDataset({
        id: dataset.id.toString(),
        numRows: dataset.num_rows,
        columnNames: dataset.column_names,
        columnTypes: dataset.column_types as Record<string, string>,
        name: dataset.name,
        uploadAt: dataset.uploaded_at,
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
      setPendingDataset({
        id: dataset.id,
        numRows: dataset.numRows,
        columnNames: dataset.columnNames,
        columnTypes: dataset.columnTypes,
        name: dataset.name,
        uploadAt: dataset.uploadAt,
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
    
    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      datasetId: pendingDataset?.id || 'unknown', 
      datasetName: pendingDataset?.name || 'unknown',
      targetFeature: config.targetFeature,
      frozenFeatures: config.frozenFeatures,
      createdAt: new Date(),
    };
    setAnalyses([newAnalysis, ...analyses]);
    setActiveAnalysis(newAnalysis.id);
  };

  /** Called when user clicks "Generate Counterfactuals" in CounterfactualConfigForm. */
  const handleCounterfactualConfigSubmit = () => {
    if (activeAnalysis != null){
      setActiveAnalysis(activeAnalysis);
    }
    clearPendingFlow();
  };

  // -------------------------------------------------------------------------

  const renderMainContent = () => {
    // Step 1 - feature config
    if (analysisStep === 'feature-config' && pendingDataset) {
      return (
        <FeatureConfigForm
          datasetName={pendingDataset.name}
          datasetId={pendingDataset.id}
          features={pendingDataset.columnNames}
          onConfirm={handleFeatureConfigConfirm}
        />
      );
    } 

    // Step 2 - counterfactual outcome + instance values
    if (analysisStep === 'counterfactual-config' && pendingDataset && pendingConfig) {
      console.log('Configuring counterfactuals with dataset:', pendingDataset);
      const featureMetas = pendingDataset.columnNames.map((name) => ({
        name,
        type: pendingDataset.columnTypes[name] as 'integer' | 'float' | 'string',
      }));

      return (
        <CounterfactualConfigForm
          datasetName={pendingDataset.name}
          targetFeature={pendingConfig.targetFeature}
          frozenFeatures={pendingConfig.frozenFeatures}
          featureMetas={featureMetas}
          onBack={() => setAnalysisStep('feature-config')}
          onSubmit={handleCounterfactualConfigSubmit}
        />
      );
    }

    // Analysis selected - show output page
    if (currentAnalysis) {
      const placeholderData = {
        datasetName: currentAnalysis.datasetName,
        modelName: 'Random Forest Classifier',
        llmSummary:
          `The model predicts the outcome based on several key features. ` +
          `The most influential factor is "${currentAnalysis.targetFeature}", ` +
          `which drives the prediction significantly. Counterfactual analysis suggests ` +
          `that small adjustments to the top features below could flip the outcome.`,
        shapAnalysis: {
          summary:
            'SHAP analysis reveals the relative contribution of each feature to the model output.',
          topFeatures: [
            { name: currentAnalysis.targetFeature, importance: 0.42 },
            { name: currentAnalysis.frozenFeatures[0] ?? 'Feature A', importance: 0.28 },
            { name: currentAnalysis.frozenFeatures[1] ?? 'Feature B', importance: 0.17 },
            { name: 'Other', importance: 0.13 },
          ],
        },
        diceAnalysis: {
          summary:
            'DiCE-ML generated 3 diverse counterfactuals that would change the model prediction.',
          counterfactuals: [
            {
              feature: currentAnalysis.targetFeature,
              original: '0',
              suggested: '1',
            },
            {
              feature: currentAnalysis.frozenFeatures[0] ?? 'Feature A',
              original: '23',
              suggested: '31',
            },
            {
              feature: currentAnalysis.frozenFeatures[1] ?? 'Feature B',
              original: 'Low',
              suggested: 'High',
            },
          ],
        },
      };

      return <AnalysisOutput analysis={placeholderData} />;
    }

    // Normal states
    return <EmptyAnalysisState onOpenUpload={() => setUploadModalOpen(true)} />;
  };

  // -------------------------------------------------------------------------

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