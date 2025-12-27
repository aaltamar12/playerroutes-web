'use client';

import { useState, useMemo } from 'react';
import { PlayerSession } from '@/types';

interface PlayerListProps {
  sessions: Map<string, PlayerSession>;
  selectedSessionId?: string | null;
  onSessionSelect?: (sessionId: string | null) => void;
}

interface PlayerGroup {
  playerName: string;
  playerUuid: string;
  sessions: PlayerSession[];
  lastSeen: number;
}

const DIMENSION_ICONS: Record<string, { color: string; label: string }> = {
  'minecraft:overworld': { color: 'bg-green-500', label: 'Overworld' },
  'minecraft:the_nether': { color: 'bg-red-500', label: 'Nether' },
  'minecraft:the_end': { color: 'bg-purple-500', label: 'End' },
};

function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today ${time}`;
  } else if (isYesterday) {
    return `Yesterday ${time}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`;
  }
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

type SortOrder = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

export function PlayerList({ sessions, selectedSessionId, onSessionSelect }: PlayerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');

  const { activeSessions, playerGroups, totalActive, isSearching } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const allSessions = Array.from(sessions.values());

    const active = allSessions.filter((s) => s.active);
    const totalActive = active.length;

    const filteredActive = query
      ? active.filter((s) => s.playerName.toLowerCase().includes(query))
      : active;

    // Group inactive sessions by player
    const inactive = allSessions
      .filter((s) => !s.active)
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));

    const filteredInactive = query
      ? inactive.filter((s) => s.playerName.toLowerCase().includes(query))
      : inactive;

    // Group by player UUID
    const groupMap = new Map<string, PlayerGroup>();
    for (const session of filteredInactive) {
      const existing = groupMap.get(session.playerUuid);
      if (existing) {
        existing.sessions.push(session);
        if ((session.endedAt || 0) > existing.lastSeen) {
          existing.lastSeen = session.endedAt || session.lastSeenAt;
          existing.playerName = session.playerName; // Use most recent name
        }
      } else {
        groupMap.set(session.playerUuid, {
          playerName: session.playerName,
          playerUuid: session.playerUuid,
          sessions: [session],
          lastSeen: session.endedAt || session.lastSeenAt,
        });
      }
    }

    // Sort groups based on sortOrder
    let groups = Array.from(groupMap.values());

    switch (sortOrder) {
      case 'date-desc':
        groups.sort((a, b) => b.lastSeen - a.lastSeen);
        break;
      case 'date-asc':
        groups.sort((a, b) => a.lastSeen - b.lastSeen);
        break;
      case 'name-asc':
        groups.sort((a, b) => a.playerName.localeCompare(b.playerName));
        break;
      case 'name-desc':
        groups.sort((a, b) => b.playerName.localeCompare(a.playerName));
        break;
    }

    // Limit results
    groups = groups.slice(0, query ? 50 : 10);

    return {
      activeSessions: filteredActive,
      playerGroups: groups,
      totalActive,
      isSearching: query.length > 0,
    };
  }, [sessions, searchQuery, sortOrder]);

  const togglePlayerExpanded = (playerUuid: string) => {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerUuid)) {
        next.delete(playerUuid);
      } else {
        next.add(playerUuid);
      }
      return next;
    });
  };

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

        {/* Recent Sessions - Grouped by Player */}
        {playerGroups.length > 0 && (
          <div className="p-2 border-t border-slate-700">
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isSearching ? 'Results' : 'Recent'}
              </h3>
              {isSearching && (
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="text-xs bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="date-desc">Newest first</option>
                  <option value="date-asc">Oldest first</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                </select>
              )}
            </div>
            {playerGroups.map((group) => {
              const isExpanded = expandedPlayers.has(group.playerUuid);
              const hasMultipleSessions = group.sessions.length > 1;

              return (
                <div key={group.playerUuid} className="mb-1">
                  {/* Player Header */}
                  <button
                    onClick={() => {
                      if (hasMultipleSessions) {
                        togglePlayerExpanded(group.playerUuid);
                      } else {
                        onSessionSelect?.(group.sessions[0]._id);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      !hasMultipleSessions && selectedSessionId === group.sessions[0]._id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {hasMultipleSessions && (
                        <svg
                          className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      {!hasMultipleSessions && (
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      )}
                      <span className="font-medium truncate flex-1">{group.playerName}</span>
                      {hasMultipleSessions && (
                        <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                          {group.sessions.length}
                        </span>
                      )}
                    </div>
                    <div className="ml-4 text-xs text-slate-500 mt-1">
                      {formatRelativeDate(group.lastSeen)}
                      {!hasMultipleSessions && (
                        <>
                          <span className="mx-1">·</span>
                          <span>{formatDuration(group.sessions[0].startedAt, group.sessions[0].endedAt)}</span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Expanded Sessions */}
                  {hasMultipleSessions && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {group.sessions.map((session) => (
                        <button
                          key={session._id}
                          onClick={() => onSessionSelect?.(session._id)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                            selectedSessionId === session._id
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span className="text-sm">{formatRelativeDate(session.endedAt || session.lastSeenAt)}</span>
                          </div>
                          <div className="ml-4 text-xs text-slate-500">
                            {formatDuration(session.startedAt, session.endedAt)}
                            <span className="mx-1">·</span>
                            {Math.round(session.stats.distanceXZ)} blocks
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeSessions.length === 0 && playerGroups.length === 0 && (
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
