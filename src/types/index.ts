export interface RoutePoint {
  t: number;
  x: number;
  y: number;
  z: number;
  dim: string;
}

export interface SessionStats {
  samples: number;
  distanceXZ: number;
}

export interface ConnectionStatus {
  online: boolean;
  pingMs: number;
}

export interface PlayerSession {
  _id: string;
  playerUuid: string;
  playerName: string;
  startedAt: number;
  endedAt?: number;
  active: boolean;
  lastSeenAt: number;
  stats: SessionStats;
  path: RoutePoint[];
}

export interface SessionSummary {
  sessionId: string;
  playerUuid: string;
  playerName: string;
  startedAt: number;
  endedAt?: number;
  active: boolean;
  lastSeenAt: number;
  stats: SessionStats;
  lastPoint?: RoutePoint;
  conn: ConnectionStatus;
}

export type WebSocketMessage =
  | { type: 'init'; activeSessions: PlayerSession[]; worldTime?: number }
  | { type: 'session_start'; session: PlayerSession }
  | { type: 'session_end'; sessionId: string; playerUuid: string; playerName: string; endedAt: number; stats: SessionStats }
  | { type: 'route_point'; sessionId: string; playerUuid: string; playerName: string; point: RoutePoint; conn: ConnectionStatus; worldTime?: number }
  | { type: 'time_update'; worldTime: number }
  | { type: 'command_response'; success: boolean; message: string };

export interface Player {
  uuid: string;
  name: string;
  online: boolean;
  lastSeenAt: number;
  currentSessionId?: string;
  sessionCount: number;
}
