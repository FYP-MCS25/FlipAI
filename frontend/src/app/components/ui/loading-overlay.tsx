import React from 'react';

interface LoadingOverlayProps {
  title?: string;
  detail?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ title = 'Loading...', detail }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="mx-4 w-full max-w-md rounded-xl border border-white/15 bg-neutral-900/90 p-6 text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-blue-400" />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {detail && <p className="mt-2 text-sm text-white/70">{detail}</p>}
    </div>
  </div>
);
