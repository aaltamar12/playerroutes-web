'use client';

interface ConnectionStatusProps {
  connected: boolean;
  onReconnect?: () => void;
  onSettings?: () => void;
  onDisconnect?: () => void;
}

export function ConnectionStatus({ connected, onReconnect, onSettings, onDisconnect }: ConnectionStatusProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
          connected
            ? 'bg-green-900/80 text-green-300'
            : 'bg-red-900/80 text-red-300'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}
        ></span>
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
        {!connected && onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-2 px-2 py-0.5 bg-red-800 hover:bg-red-700 rounded text-xs cursor-pointer"
          >
            Reconnect
          </button>
        )}
      </div>
      {onSettings && (
        <button
          onClick={onSettings}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 transition-colors cursor-pointer"
          title="Server settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
