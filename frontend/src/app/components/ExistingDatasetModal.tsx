import { X, Database, Calendar } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  uploadDate: Date;
  rowCount: number;
}

interface ExistingDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: Dataset[];
  onSelectDataset: (datasetId: string) => void;
}

export function ExistingDatasetModal({
  isOpen,
  onClose,
  datasets,
  onSelectDataset,
}: ExistingDatasetModalProps) {
  if (!isOpen) return null;

  const handleSelectDataset = (datasetId: string) => {
    onSelectDataset(datasetId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Choose Existing Dataset</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Dataset List */}
        <div className="flex-1 overflow-y-auto p-6">
          {datasets.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No datasets available. Upload a dataset to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => handleSelectDataset(dataset.id)}
                  className="w-full p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                      <Database className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium mb-1">{dataset.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {dataset.uploadDate.toLocaleDateString()}
                        </span>
                        <span>{dataset.rowCount.toLocaleString()} rows</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
