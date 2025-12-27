'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlayerSession } from '@/types';

interface SessionDetailsProps {
  session: PlayerSession | null;
  sessions?: Map<string, PlayerSession>;
  onClose?: () => void;
  onTeleport?: (data: { player: string; targetPlayer?: string; x?: number; y?: number; z?: number }) => void;
  commandResult?: { success: boolean; message: string } | null;
}

type TeleportMode = 'player' | 'coords';

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const duration = Math.floor((end - startTime) / 1000);

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${Math.round(distance)} blocks`;
  }
  return `${(distance / 1000).toFixed(2)} km`;
}

function getDimensionDisplay(dim: string): { name: string; color: string } {
  switch (dim) {
    case 'minecraft:overworld':
      return { name: 'Overworld', color: 'text-green-400' };
    case 'minecraft:the_nether':
      return { name: 'Nether', color: 'text-red-400' };
    case 'minecraft:the_end':
      return { name: 'The End', color: 'text-purple-400' };
    default:
      return { name: dim.split(':').pop() || dim, color: 'text-slate-400' };
  }
}

export function SessionDetails({ session, sessions, onClose, onTeleport, commandResult }: SessionDetailsProps) {
  const [teleportMode, setTeleportMode] = useState<TeleportMode>('player');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [coords, setCoords] = useState({ x: '', y: '', z: '' });
  const [copied, setCopied] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);

  // Reset teleporting state when commandResult arrives
  useEffect(() => {
    if (commandResult) {
      setIsTeleporting(false);
    }
  }, [commandResult]);

  // Reset teleporting state when session changes
  useEffect(() => {
    setIsTeleporting(false);
  }, [session?._id]);

  // Get active players for dropdown
  const activePlayers = useMemo(() => {
    if (!sessions) return [];
    return Array.from(sessions.values())
      .filter((s) => s.active && s._id !== session?._id)
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [sessions, session?._id]);

  // Filter players by search
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return activePlayers;
    const query = playerSearch.toLowerCase();
    return activePlayers.filter((p) => p.playerName.toLowerCase().includes(query));
  }, [activePlayers, playerSearch]);

  // Generate teleport command
  const getTeleportCommand = (): string | null => {
    if (!session) return null;

    if (teleportMode === 'player' && selectedPlayer) {
      const targetSession = sessions?.get(selectedPlayer);
      if (targetSession) {
        return `/tp ${session.playerName} ${targetSession.playerName}`;
      }
    } else if (teleportMode === 'coords' && coords.x && coords.y && coords.z) {
      return `/tp ${session.playerName} ${coords.x} ${coords.y} ${coords.z}`;
    }
    return null;
  };

  const copyCommand = () => {
    const command = getTeleportCommand();
    if (command) {
      navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const executeTeleport = () => {
    if (!session || !onTeleport || isTeleporting) return;

    setIsTeleporting(true);

    if (teleportMode === 'player' && selectedPlayer) {
      const targetSession = sessions?.get(selectedPlayer);
      if (targetSession) {
        onTeleport({
          player: session.playerName,
          targetPlayer: targetSession.playerName,
        });
      }
    } else if (teleportMode === 'coords' && coords.x && coords.y && coords.z) {
      onTeleport({
        player: session.playerName,
        x: parseFloat(coords.x),
        y: parseFloat(coords.y),
        z: parseFloat(coords.z),
      });
    }

    // Fallback timeout in case WebSocket response never arrives
    setTimeout(() => {
      setIsTeleporting(false);
    }, 10000);
  };

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId);
    setShowPlayerDropdown(false);
    setPlayerSearch('');
  };

  if (!session) {
    return (
      <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 flex items-center justify-center">
        <p className="text-slate-500 text-center">
          Select a player or session<br />to view details
        </p>
      </div>
    );
  }

  const lastPoint = session.path.length > 0 ? session.path[session.path.length - 1] : null;
  const dimension = lastPoint ? getDimensionDisplay(lastPoint.dim) : null;
  const teleportCommand = getTeleportCommand();

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{session.playerName}</h2>
          <p className="text-sm text-slate-400">
            {session.active ? (
              <span className="text-green-400">Online</span>
            ) : (
              <span className="text-slate-500">Offline</span>
            )}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current Position */}
        {lastPoint && (
          <div className="bg-slate-700/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Current Position
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-500">X</p>
                <p className="text-sm font-mono text-white">{Math.round(lastPoint.x)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Y</p>
                <p className="text-sm font-mono text-white">{Math.round(lastPoint.y)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Z</p>
                <p className="text-sm font-mono text-white">{Math.round(lastPoint.z)}</p>
              </div>
            </div>
            {dimension && (
              <p className={`text-center text-sm mt-2 ${dimension.color}`}>
                {dimension.name}
              </p>
            )}
          </div>
        )}

        {/* Session Info */}
        <div className="bg-slate-700/50 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Session Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Started</span>
              <span className="text-white">{formatDateTime(session.startedAt)}</span>
            </div>
            {session.endedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Ended</span>
                <span className="text-white">{formatDateTime(session.endedAt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Duration</span>
              <span className="text-white">{formatDuration(session.startedAt, session.endedAt)}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-700/50 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Statistics
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Distance Traveled</span>
              <span className="text-white">{formatDistance(session.stats.distanceXZ)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Points Recorded</span>
              <span className="text-white">{session.stats.samples.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Path Length</span>
              <span className="text-white">{session.path.length.toLocaleString()} points</span>
            </div>
          </div>
        </div>

        {/* Teleport */}
        {session.active && (
          <div className="bg-slate-700/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Teleport
            </h3>

            {/* Mode Toggle */}
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setTeleportMode('player')}
                className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors cursor-pointer ${
                  teleportMode === 'player'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                To Player
              </button>
              <button
                onClick={() => setTeleportMode('coords')}
                className={`flex-1 text-xs py-1.5 px-2 rounded transition-colors cursor-pointer ${
                  teleportMode === 'coords'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                To Coords
              </button>
            </div>

            {/* Player Dropdown */}
            {teleportMode === 'player' && (
              <div className="relative mb-3">
                <div
                  onClick={() => setShowPlayerDropdown(!showPlayerDropdown)}
                  className="w-full bg-slate-600 text-slate-200 rounded px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
                >
                  <span className={selectedPlayer ? 'text-white' : 'text-slate-400'}>
                    {selectedPlayer
                      ? sessions?.get(selectedPlayer)?.playerName || 'Select player'
                      : 'Select player...'}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showPlayerDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {showPlayerDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-600">
                      <input
                        type="text"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        placeholder="Search players..."
                        className="w-full bg-slate-600 text-slate-200 placeholder-slate-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>

                    {/* Player List */}
                    <div className="max-h-32 overflow-y-auto">
                      {filteredPlayers.length > 0 ? (
                        filteredPlayers.map((player) => (
                          <button
                            key={player._id}
                            onClick={() => handlePlayerSelect(player._id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 cursor-pointer flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {player.playerName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-slate-500">
                          {activePlayers.length === 0 ? 'No other players online' : 'No players found'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Coordinates Input */}
            {teleportMode === 'coords' && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">X</label>
                  <input
                    type="number"
                    value={coords.x}
                    onChange={(e) => setCoords({ ...coords, x: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-600 text-white rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Y</label>
                  <input
                    type="number"
                    value={coords.y}
                    onChange={(e) => setCoords({ ...coords, y: e.target.value })}
                    placeholder="64"
                    className="w-full bg-slate-600 text-white rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Z</label>
                  <input
                    type="number"
                    value={coords.z}
                    onChange={(e) => setCoords({ ...coords, z: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-600 text-white rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Command Preview & Copy */}
            {teleportCommand && (
              <div className="bg-slate-900 rounded p-2 mb-2">
                <code className="text-xs text-green-400 break-all">{teleportCommand}</code>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={copyCommand}
                disabled={!teleportCommand}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                  teleportCommand
                    ? copied
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>

              {onTeleport && (
                <button
                  onClick={executeTeleport}
                  disabled={!teleportCommand || isTeleporting}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
                    !teleportCommand || isTeleporting
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isTeleporting ? 'Teleporting...' : 'Teleport'}
                </button>
              )}
            </div>

            {/* Command Result */}
            {commandResult && (
              <div className={`mt-2 p-2 rounded text-xs ${
                commandResult.success
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}>
                {commandResult.message}
              </div>
            )}
          </div>
        )}

        {/* IDs */}
        <div className="bg-slate-700/50 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Identifiers
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400 block text-xs">Session ID</span>
              <span className="text-white font-mono text-xs break-all">{session._id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">Player UUID</span>
              <span className="text-white font-mono text-xs break-all">{session.playerUuid}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
