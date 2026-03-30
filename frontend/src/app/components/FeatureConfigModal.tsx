import { X, Target, Lock, Search } from 'lucide-react';
import { useState } from 'react';

interface FeatureConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  features: string[];
  onConfirm: (config: { targetFeature: string; frozenFeatures: string[] }) => void;
}

export function FeatureConfigModal({
  isOpen,
  onClose,
  datasetName,
  features,
  onConfirm,
}: FeatureConfigModalProps) {
  const [targetFeature, setTargetFeature] = useState<string>(features[0] || '');
  const [frozenFeatures, setFrozenFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const handleToggleFrozenFeature = (feature: string) => {
    if (frozenFeatures.includes(feature)) {
      setFrozenFeatures(frozenFeatures.filter((f) => f !== feature));
    } else {
      setFrozenFeatures([...frozenFeatures, feature]);
    }
  };

  const handleConfirm = () => {
    onConfirm({ targetFeature, frozenFeatures });
    onClose();
  };

  // Filter features based on search query
  const filteredFeatures = features.filter((feature) =>
    feature.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Configure Counterfactual Analysis</h2>
            <p className="text-sm text-white/60 mt-1">{datasetName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Search Box */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-white/40" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Feature Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-600/20">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Target Feature to Flip</h3>
                <p className="text-sm text-white/60">
                  Select the prediction outcome you want to change
                </p>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              {filteredFeatures.length === 0 ? (
                <p className="text-white/40 text-center py-4">No features found</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredFeatures.map((feature) => (
                    <label
                      key={feature}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                    >
                      <input
                        type="radio"
                        name="targetFeature"
                        checked={targetFeature === feature}
                        onChange={() => setTargetFeature(feature)}
                        className="w-4 h-4 border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-white">{feature}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Frozen Features Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-600/20">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Features to Freeze</h3>
                <p className="text-sm text-white/60">
                  Select features that should remain constant during counterfactual generation
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              {filteredFeatures.length === 0 ? (
                <p className="text-white/40 text-center py-4">No features found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredFeatures.map((feature) => (
                    <label
                      key={feature}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        feature === targetFeature
                          ? 'bg-white/5 opacity-50 cursor-not-allowed'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={frozenFeatures.includes(feature)}
                        onChange={() => handleToggleFrozenFeature(feature)}
                        disabled={feature === targetFeature}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className={`text-white ${feature === targetFeature ? 'opacity-50' : ''}`}>
                        {feature}
                      </span>
                      {feature === targetFeature && (
                        <span className="ml-auto text-xs text-white/40">(Target feature)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {frozenFeatures.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Lock className="w-4 h-4" />
                <span>{frozenFeatures.length} feature{frozenFeatures.length !== 1 ? 's' : ''} will be frozen</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Start Analysis
          </button>
        </div>
      </div>
    </div>
  );
}