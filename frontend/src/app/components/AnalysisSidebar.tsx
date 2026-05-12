import { FileBarChart, Trash2, PanelLeftClose, User, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';

type TrainingStatus = 'running' | 'completed' | 'failed';

interface Analysis {
  id: string;
  datasetId: string;  
  datasetName: string;
  targetFeature: string;
  frozenFeatures: string[];
  createdAt: Date;
  trainingStatus: TrainingStatus;
}

interface AnalysisSidebarProps {
  analyses: Analysis[];
  activeAnalysis: string | null;
  onSelectAnalysis: (analysisId: string) => void;
  onDeleteAnalysis: (analysisId: string) => void;
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
}

export function AnalysisSidebar({
  analyses,
  activeAnalysis,
  onSelectAnalysis,
  onDeleteAnalysis,
  onToggleSidebar,
  onOpenProfile,
}: AnalysisSidebarProps) {
  const [hoveredAnalysis, setHoveredAnalysis] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  const statusMeta = (status: TrainingStatus) => {
    if (status === 'running') {
      return {
        label: 'Training',
        className: 'text-blue-600 dark:text-blue-300',
        dotClassName: 'bg-blue-600 dark:bg-blue-400',
      };
    }
    if (status === 'completed') {
      return {
        label: 'Ready',
        className: 'text-emerald-600 dark:text-emerald-300',
        dotClassName: 'bg-emerald-600 dark:bg-emerald-400',
      };
    }
    if (status === 'failed') {
      return {
        label: 'Failed',
        className: 'text-red-600 dark:text-red-300',
        dotClassName: 'bg-red-600 dark:bg-red-400',
      };
    }
    return {
      label: 'Idle',
      className: 'text-muted-foreground',
      dotClassName: 'bg-muted-foreground/60',
    };
  };

  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex h-full min-h-0 flex-col border-r border-sidebar-border overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 flex items-center border-b border-sidebar-border flex-shrink-0">
        <h2 className="text-lg font-semibold">Analysis History</h2>
      </div>

      {/* Analysis History */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {analyses.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No analyses yet. Upload a dataset to get started.
            </div>
          ) : (
            analyses.map((analysis) => {
              const trainingStatus = statusMeta(analysis.trainingStatus);

              return (
              <div
                key={analysis.id}
                className={`group relative flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                  activeAnalysis === analysis.id
                    ? 'bg-sidebar-accent'
                    : 'hover:bg-sidebar-accent/70'
                }`}
                onClick={() => onSelectAnalysis(analysis.id)}
                onMouseEnter={() => setHoveredAnalysis(analysis.id)}
                onMouseLeave={() => setHoveredAnalysis(null)}
              >
                <FileBarChart className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-sidebar-foreground">
                    {analysis.datasetName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{formatDateTime(analysis.createdAt)}</span>
                    <span className={`inline-flex items-center gap-1 ${trainingStatus.className}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${trainingStatus.dotClassName}`} />
                      <span>{trainingStatus.label}</span>
                    </span>
                  </div>
                </div>
                {hoveredAnalysis === analysis.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAnalysis(analysis.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-sidebar-accent rounded transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer with collapse button */}
      <div className="flex-shrink-0 p-3 border-t border-sidebar-border space-y-2">
        <button
          type="button"
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            {isLight ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-blue-400" />
            )}
            <span>Light mode</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {isLight ? 'On' : 'Off'}
          </span>
        </button>
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm text-muted-foreground"
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
        <button
          onClick={onToggleSidebar}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm text-muted-foreground"
        >
          <PanelLeftClose className="w-4 h-4" />
          <span>Close sidebar</span>
        </button>
      </div>
    </div>
  );
}