import React from 'react';

interface LoadingOverlayProps {
  title?: string;
  detail?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ title = 'Loading...', detail }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card/90 p-6 text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-border/60 border-t-blue-400" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
    </div>
  </div>
);
