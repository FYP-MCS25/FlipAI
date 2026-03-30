import { Target, Lock, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface FeatureConfigFormProps {
  datasetName: string;
  modelName: string;
  features: string[];
  onConfirm: (config: { targetFeature: string; frozenFeatures: string[] }) => void;
}

const FEATURES_PER_PAGE = 10;

export function FeatureConfigForm({
  datasetName,
  modelName,
  features,
  onConfirm,
}: FeatureConfigFormProps) {
  const [targetFeature, setTargetFeature] = useState<string>('');
  const [frozenFeatures, setFrozenFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filter features based on search query
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;
    return features.filter((feature) =>
      feature.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [features, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFeatures.length / FEATURES_PER_PAGE);
  const startIndex = (currentPage - 1) * FEATURES_PER_PAGE;
  const endIndex = startIndex + FEATURES_PER_PAGE;
  const currentFeatures = filteredFeatures.slice(startIndex, endIndex);

  // When search query changes, find the page containing the first match
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && filteredFeatures.length > 0) {
      // Find which page the first matching feature is on
      const firstMatchIndex = features.findIndex((feature) =>
        feature.toLowerCase().includes(query.toLowerCase())
      );
      if (firstMatchIndex !== -1) {
        const pageWithMatch = Math.floor(firstMatchIndex / FEATURES_PER_PAGE) + 1;
        setCurrentPage(pageWithMatch);
      }
    } else {
      setCurrentPage(1);
    }
  };

  const handleToggleTarget = (feature: string) => {
    if (targetFeature === feature) {
      setTargetFeature('');
    } else {
      setTargetFeature(feature);
      // Remove from frozen if it was frozen
      setFrozenFeatures(frozenFeatures.filter((f) => f !== feature));
    }
  };

  const handleToggleFrozen = (feature: string) => {
    if (frozenFeatures.includes(feature)) {
      setFrozenFeatures(frozenFeatures.filter((f) => f !== feature));
    } else {
      setFrozenFeatures([...frozenFeatures, feature]);
      // Remove from target if it was target
      if (targetFeature === feature) {
        setTargetFeature('');
      }
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleConfirm = () => {
    if (!targetFeature) {
      alert('Please select a target feature');
      return;
    }
    onConfirm({ targetFeature, frozenFeatures });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">{datasetName}</h1>
          <p className="text-white/60">Model: {modelName}</p>
        </div>

        {/* Search */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-white/40" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-white/60 mt-2">
              Found {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-black/20 border border-white/10">
              <div className="p-2 rounded-lg bg-blue-600/20 flex-shrink-0">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Target Feature</h3>
                <p className="text-sm text-white/60">
                  Select ONE feature you want to flip in the prediction outcome
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-black/20 border border-white/10">
              <div className="p-2 rounded-lg bg-amber-600/20 flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Frozen Features</h3>
                <p className="text-sm text-white/60">
                  Select features that should remain constant (optional)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature List */}
        {filteredFeatures.length === 0 ? (
          <div className="bg-white/5 rounded-xl border border-white/10 text-center py-12 px-6">
            <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No features found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* Header Row */}
            <div className="flex items-center gap-4 p-4 bg-white/5 border-b border-white/10">
              <div className="flex-1 text-sm font-medium text-white/60">Feature Name</div>
              <div className="text-sm font-medium text-white/60 text-center w-20">
                <div className="flex items-center justify-center gap-1.5">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span>Target</span>
                </div>
              </div>
              <div className="text-sm font-medium text-white/60 text-center w-20">
                <div className="flex items-center justify-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Freeze</span>
                </div>
              </div>
            </div>

            {/* Feature Rows */}
            <div className="divide-y divide-white/5">
              {currentFeatures.map((feature, index) => {
                const globalIndex = startIndex + index + 1;
                const isTarget = targetFeature === feature;
                const isFrozen = frozenFeatures.includes(feature);

                return (
                  <div
                    key={feature}
                    className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                  >
                    {/* Feature Name - Left Side */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm text-white/60 flex-shrink-0">
                        {globalIndex}
                      </div>
                      <span className="text-white">{feature}</span>
                    </div>

                    {/* Target Checkbox - Right Side */}
                    <div className="flex items-center justify-center w-20">
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isTarget}
                          onChange={() => handleToggleTarget(feature)}
                          className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Freeze Checkbox - Right Side */}
                    <div className="flex items-center justify-center w-20">
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFrozen}
                          onChange={() => handleToggleFrozen(feature)}
                          className="w-5 h-5 rounded border-white/20 bg-white/5 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {filteredFeatures.length > FEATURES_PER_PAGE && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
              <span className="text-white font-medium">{currentPage}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/60">{totalPages}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Action Section */}
        <div className="p-4 border border-white/10 rounded-xl bg-white/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 text-sm text-white/60 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span>
                  Target:{' '}
                  {targetFeature ? (
                    <span className="text-white font-medium">{targetFeature}</span>
                  ) : (
                    <span className="text-white/40">None selected</span>
                  )}
                </span>
              </div>
              {frozenFeatures.length > 0 && (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>
                    {frozenFeatures.length} frozen feature{frozenFeatures.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!targetFeature}
              className="w-full md:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              Start Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}