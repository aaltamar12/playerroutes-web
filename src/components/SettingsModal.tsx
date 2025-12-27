'use client';

import { ServerConfig } from './AuthGate';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: ServerConfig;
  onSave: (config: ServerConfig) => void;
  onLogout: () => void;
}

export function SettingsModal({ isOpen, onClose, currentConfig, onLogout }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Connection Info */}
          <div className="bg-slate-700/50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Connected to</p>
            <p className="text-sm text-white font-mono break-all">
              {currentConfig.wsUrl}
            </p>
          </div>

          <p className="text-xs text-slate-500">
            The connection is auto-detected from your browser. The web app must run on the same server as the Minecraft mod.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onLogout}
            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors cursor-pointer text-sm"
          >
            Disconnect & Logout
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors cursor-pointer text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
