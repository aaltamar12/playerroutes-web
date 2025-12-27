'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { AuthGate, ServerConfig } from '@/components/AuthGate';
import { MapCanvas, MapCanvasRef } from '@/components/MapCanvas';
import { PlayerList } from '@/components/PlayerList';
import { SessionDetails } from '@/components/SessionDetails';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { SettingsModal } from '@/components/SettingsModal';
import { DimensionSelector, Dimension, dimensionToShort, dimensionToFull } from '@/components/DimensionSelector';
import { WorldTime } from '@/components/WorldTime';
import { useWebSocket } from '@/hooks/useWebSocket';

interface MapAppProps {
  token: string;
  serverConfig: ServerConfig;
  onConfigChange: (config: ServerConfig) => void;
  onLogout: () => void;
}

function MapApp({ token, serverConfig, onConfigChange, onLogout }: MapAppProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentDimension, setCurrentDimension] = useState<Dimension>('overworld');
  const [commandResult, setCommandResult] = useState<{ success: boolean; message: string } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const mapRef = useRef<MapCanvasRef>(null);

  const { connected, sessions, worldTime, reconnect, sendMessage } = useWebSocket({
    url: serverConfig.wsUrl,
    token,
    apiUrl: serverConfig.apiUrl,
    onSessionStart: (session) => {
      console.log('Session started:', session.playerName);
    },
    onSessionEnd: (sessionId) => {
      console.log('Session ended:', sessionId);
    },
    onCommandResponse: (success, message) => {
      console.log('Command response:', success, message);
      setCommandResult({ success, message });
      // Clear after 3 seconds
      setTimeout(() => setCommandResult(null), 3000);
    },
  });

  const selectedSession = selectedSessionId ? sessions.get(selectedSessionId) : null;

  // Hide initial loading once connected
  useEffect(() => {
    if (connected && initialLoading) {
      setInitialLoading(false);
    }
  }, [connected, initialLoading]);

  // Get current dimension for each active player
  const playerDimensions = useMemo(() => {
    const dims = new Map<string, string>();
    sessions.forEach((session, sessionId) => {
      if (session.active && session.path.length > 0) {
        const lastPoint = session.path[session.path.length - 1];
        dims.set(sessionId, lastPoint.dim);
      }
    });
    return dims;
  }, [sessions]);

  // Auto-switch dimension when selecting a player in a different dimension
  const handleDimensionChange = useCallback((dimension: Dimension) => {
    setCurrentDimension(dimension);
    // Reset view when switching dimensions
    mapRef.current?.resetView();
  }, []);

  const handleSessionSelect = useCallback((sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    // Center on selected player and switch to their dimension
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session && session.path.length > 0) {
        const lastPoint = session.path[session.path.length - 1];
        // Switch to player's dimension
        const playerDim = dimensionToShort(lastPoint.dim);
        if (playerDim !== currentDimension) {
          setCurrentDimension(playerDim);
        }
        mapRef.current?.centerOnPosition(lastPoint.x, lastPoint.z);
      }
    }
  }, [sessions, currentDimension]);

  const handleConfigSave = (newConfig: ServerConfig) => {
    onConfigChange(newConfig);
    // Reconnect with new config
    setTimeout(() => reconnect(), 100);
  };

  const handleTeleport = (data: { player: string; targetPlayer?: string; x?: number; y?: number; z?: number }) => {
    sendMessage({
      type: 'teleport',
      ...data,
    });
  };

  // Show loading screen while connecting to WebSocket
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-300">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left Panel - Player List */}
      <PlayerList
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSessionSelect={handleSessionSelect}
      />

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <ConnectionStatus
          connected={connected}
          onReconnect={reconnect}
          onSettings={() => setShowSettings(true)}
        />
        {/* Dimension Selector and World Time */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <DimensionSelector
            currentDimension={currentDimension}
            onDimensionChange={handleDimensionChange}
            playerDimensions={playerDimensions}
          />
          <WorldTime worldTime={worldTime} />
        </div>
        <MapCanvas
          ref={mapRef}
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSessionSelect={handleSessionSelect}
          authToken={token}
          apiBaseUrl={serverConfig.apiUrl}
          currentDimension={currentDimension}
          onRefreshTiles={(dimension) => sendMessage({ type: 'refresh_tiles', dimension })}
        />
      </div>

      {/* Right Panel - Session Details */}
      <SessionDetails
        session={selectedSession || null}
        sessions={sessions}
        onClose={() => setSelectedSessionId(null)}
        onTeleport={handleTeleport}
        commandResult={commandResult}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentConfig={serverConfig}
        onSave={handleConfigSave}
        onLogout={onLogout}
      />
    </div>
  );
}

export default function Home() {
  const [authToken, setAuthToken] = useState<string>('');
  const [serverConfig, setServerConfig] = useState<ServerConfig>({ wsUrl: '', apiUrl: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuthenticated = (token: string, config: ServerConfig) => {
    setAuthToken(token);
    setServerConfig(config);
    setIsAuthenticated(true);
  };

  const handleConfigChange = (newConfig: ServerConfig) => {
    setServerConfig(newConfig);
    localStorage.setItem('playerroutes_server_config', JSON.stringify(newConfig));
  };

  const handleLogout = () => {
    localStorage.removeItem('playerroutes_auth_token');
    localStorage.removeItem('playerroutes_server_config');
    setAuthToken('');
    setServerConfig({ wsUrl: '', apiUrl: '' });
    setIsAuthenticated(false);
    window.location.reload();
  };

  return (
    <AuthGate onAuthenticated={handleAuthenticated}>
      <MapApp
        token={authToken}
        serverConfig={serverConfig}
        onConfigChange={handleConfigChange}
        onLogout={handleLogout}
      />
    </AuthGate>
  );
}
