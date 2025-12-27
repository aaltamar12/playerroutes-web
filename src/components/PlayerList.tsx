'use client';

import { useState, useMemo } from 'react';
import { PlayerSession } from '@/types';

interface PlayerListProps {
  sessions: Map<string, PlayerSession>;
  selectedSessionId?: string | null;
  onSessionSelect?: (sessionId: string | null) => void;
}

const DIMENSION_ICONS: Record<string, { color: string; label: string }> = {
  'minecraft:overworld': { color: 'bg-green-500', label: 'Overworld' },
  'minecraft:the_nether': { color: 'bg-red-500', label: 'Nether' },
  'minecraft:the_end': { color: 'bg-purple-500', label: 'End' },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const duration = Math.floor((end - startTime) / 1000);

  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m`;

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getDimensionInfo(session: PlayerSession): { color: string; label: string } | null {
  if (session.path.length === 0) return null;
  const lastPoint = session.path[session.path.length - 1];
  return DIMENSION_ICONS[lastPoint.dim] || { color: 'bg-gray-500', label: 'Unknown' };
}

export function PlayerList({ sessions, selectedSessionId, onSessionSelect }: PlayerListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { activeSessions, recentInactiveSessions, totalActive } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const allSessions = Array.from(sessions.values());

    const active = allSessions.filter((s) => s.active);
    const totalActive = active.length;

    const filteredActive = query
      ? active.filter((s) => s.playerName.toLowerCase().includes(query))
      : active;

    const inactive = allSessions
      .filter((s) => !s.active)
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));

    const filteredInactive = query
      ? inactive.filter((s) => s.playerName.toLowerCase().includes(query))
      : inactive.slice(0, 5);

    return {
      activeSessions: filteredActive,
      recentInactiveSessions: query ? filteredInactive : filteredInactive.slice(0, 5),
      totalActive,
    };
  }, [sessions, searchQuery]);

  return (
    <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Players</h2>
        <p className="text-sm text-slate-400">{totalActive} online</p>

        {/* Search Input */}
        <div className="mt-3 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Online Players */}
        {activeSessions.length > 0 && (
          <div className="p-2">
            <h3 className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Online
            </h3>
            {activeSessions.map((session) => {
              const dimInfo = getDimensionInfo(session);
              return (
                <button
                  key={session._id}
                  onClick={() => onSessionSelect?.(session._id)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${
                    selectedSessionId === session._id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="font-medium truncate flex-1">{session.playerName}</span>
                    {dimInfo && (
                      <span
                        className={`w-2 h-2 rounded-full ${dimInfo.color}`}
                        title={dimInfo.label}
                      ></span>
                    )}
                  </div>
                  <div className="ml-4 text-xs text-slate-400 mt-1">
                    {session.path.length > 0 && (
                      <>
                        <span>
                          {Math.round(session.path[session.path.length - 1].x)},{' '}
                          {Math.round(session.path[session.path.length - 1].z)}
                        </span>
                        <span className="mx-1">·</span>
                      </>
                    )}
                    <span>{formatDuration(session.startedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Recent Sessions */}
        {recentInactiveSessions.length > 0 && (
          <div className="p-2 border-t border-slate-700">
            <h3 className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Recent
            </h3>
            {recentInactiveSessions.map((session) => (
              <button
                key={session._id}
                onClick={() => onSessionSelect?.(session._id)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${
                  selectedSessionId === session._id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  <span className="font-medium truncate">{session.playerName}</span>
                </div>
                <div className="ml-4 text-xs text-slate-500 mt-1">
                  <span>{formatTime(session.endedAt || session.lastSeenAt)}</span>
                  <span className="mx-1">·</span>
                  <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeSessions.length === 0 && recentInactiveSessions.length === 0 && (
          <div className="p-4 text-center text-slate-500">
            {searchQuery ? (
              <>
                <p>No players found</p>
                <p className="text-sm mt-1">Try a different search</p>
              </>
            ) : (
              <>
                <p>No players yet</p>
                <p className="text-sm mt-1">Waiting for connections...</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
