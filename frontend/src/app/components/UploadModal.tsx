import { Upload, Database, X } from 'lucide-react';
import { useRef } from 'react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadDataset: (file: File) => void;
  onChooseExisting: () => void;
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadDataset,
  onChooseExisting,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadDataset(file);
      onClose();
    }
  };

  const handleChooseExisting = () => {
    onChooseExisting();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Add Dataset</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* Upload Dataset */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                <Upload className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-1">Upload Dataset</h3>
                <p className="text-sm text-white/60">
                  Upload a CSV file to analyze with SHAP and DiCE-ML
                </p>
              </div>
            </div>
          </button>

          {/* Choose Existing */}
          <button
            onClick={handleChooseExisting}
            className="w-full p-5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-600/20 group-hover:bg-green-600/30 transition-colors">
                <Database className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-1">
                  Choose Existing Dataset
                </h3>
                <p className="text-sm text-white/60">
                  Select from previously uploaded datasets
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
