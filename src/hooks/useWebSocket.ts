'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { PlayerSession, WebSocketMessage, RoutePoint, ConnectionStatus } from '@/types';

interface UseWebSocketOptions {
  url: string;
  token: string;
  apiUrl?: string; // For fetching historical sessions
  onSessionStart?: (session: PlayerSession) => void;
  onSessionEnd?: (sessionId: string, stats: { samples: number; distanceXZ: number }) => void;
  onRoutePoint?: (sessionId: string, point: RoutePoint, conn: ConnectionStatus) => void;
  onCommandResponse?: (success: boolean, message: string) => void;
}

export function useWebSocket({
  url,
  token,
  apiUrl,
  onSessionStart,
  onSessionEnd,
  onRoutePoint,
  onCommandResponse,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<Map<string, PlayerSession>>(new Map());
  const [worldTime, setWorldTime] = useState<number | null>(null); // 0-24000 ticks
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const historicalLoadedRef = useRef(false);

  // Fetch historical sessions from API
  const fetchHistoricalSessions = useCallback(async () => {
    if (historicalLoadedRef.current) return;

    try {
      // Use apiUrl if provided, otherwise use relative URL
      const baseUrl = apiUrl || '';
      const response = await fetch(`${baseUrl}/api/sessions?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setSessions((prev) => {
            const next = new Map(prev);
            for (const session of data.sessions) {
              // Only add if not already present (active sessions from WS take priority)
              if (!next.has(session._id)) {
                next.set(session._id, session);
              }
            }
            return next;
          });
          historicalLoadedRef.current = true;
          console.log(`Loaded ${data.sessions.length} historical sessions`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch historical sessions:', error);
    }
  }, [apiUrl, token]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    wsRef.current = ws;
  }, [url, token]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        const newSessions = new Map<string, PlayerSession>();
        for (const session of message.activeSessions) {
          newSessions.set(session._id, session);
        }
        setSessions(newSessions);
        // Set world time if present in init message
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        // Load historical sessions after receiving active ones
        fetchHistoricalSessions();
        break;

      case 'session_start':
        setSessions((prev) => {
          const next = new Map(prev);
          next.set(message.session._id, message.session);
          return next;
        });
        onSessionStart?.(message.session);
        break;

      case 'session_end':
        setSessions((prev) => {
          const next = new Map(prev);
          const session = next.get(message.sessionId);
          if (session) {
            session.active = false;
            session.endedAt = message.endedAt;
            session.stats = message.stats;
          }
          return next;
        });
        onSessionEnd?.(message.sessionId, message.stats);
        break;

      case 'route_point':
        setSessions((prev) => {
          const next = new Map(prev);
          const session = next.get(message.sessionId);
          if (session) {
            session.path.push(message.point);
            session.lastSeenAt = message.point.t;
            session.stats.samples++;
            // Update distance (approximate)
            if (session.path.length > 1) {
              const lastPoint = session.path[session.path.length - 2];
              const dx = message.point.x - lastPoint.x;
              const dz = message.point.z - lastPoint.z;
              session.stats.distanceXZ += Math.sqrt(dx * dx + dz * dz);
            }
          }
          return next;
        });
        // Update world time if present
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        onRoutePoint?.(message.sessionId, message.point, message.conn);
        break;

      case 'time_update':
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        break;

      case 'command_response':
        console.log('Command response:', message.success, message.message);
        onCommandResponse?.(message.success, message.message);
        break;
    }
  }, [onSessionStart, onSessionEnd, onRoutePoint, onCommandResponse, fetchHistoricalSessions]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return {
    connected,
    sessions,
    worldTime,
    disconnect,
    reconnect: connect,
    sendMessage,
  };
}
