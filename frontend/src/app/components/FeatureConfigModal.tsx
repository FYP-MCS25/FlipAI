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
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Configure Counterfactual Analysis</h2>
            <p className="text-sm text-muted-foreground mt-1">{datasetName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search Box */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-11 pr-4 py-2.5 bg-input-background dark:bg-input/30 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Feature Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/25 dark:bg-blue-600/20">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-foreground font-medium">Target Feature to Flip</h3>
                <p className="text-sm text-muted-foreground">
                  Select the prediction outcome you want to change
                </p>
              </div>
            </div>
            
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              {filteredFeatures.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No features found</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredFeatures.map((feature) => (
                    <label
                      key={feature}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="radio"
                        name="targetFeature"
                        checked={targetFeature === feature}
                        onChange={() => setTargetFeature(feature)}
                        className="w-4 h-4 border-input bg-input-background dark:bg-input/30 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-foreground">{feature}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Frozen Features Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/25 dark:bg-amber-600/20">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-foreground font-medium">Features to Freeze</h3>
                <p className="text-sm text-muted-foreground">
                  Select features that should remain constant during counterfactual generation
                </p>
              </div>
            </div>

            <div className="bg-muted/40 border border-border rounded-lg p-4">
              {filteredFeatures.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No features found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredFeatures.map((feature) => (
                    <label
                      key={feature}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        feature === targetFeature
                          ? 'bg-muted/50 opacity-50 cursor-not-allowed'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={frozenFeatures.includes(feature)}
                        onChange={() => handleToggleFrozenFeature(feature)}
                        disabled={feature === targetFeature}
                        className="w-4 h-4 rounded border-input bg-input-background dark:bg-input/30 text-blue-600 accent-blue-600 checked:bg-blue-600 checked:border-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className={`text-foreground ${feature === targetFeature ? 'opacity-50' : ''}`}>
                        {feature}
                      </span>
                      {feature === targetFeature && (
                        <span className="ml-auto text-xs text-muted-foreground">(Target feature)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {frozenFeatures.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>{frozenFeatures.length} feature{frozenFeatures.length !== 1 ? 's' : ''} will be frozen</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 text-foreground transition-colors"
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