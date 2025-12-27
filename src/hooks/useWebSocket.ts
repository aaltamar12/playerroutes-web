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
  const [worldTime, setWorldTime] = useState<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const historicalLoadedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onSessionStart,
    onSessionEnd,
    onRoutePoint,
    onCommandResponse,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onSessionStart,
      onSessionEnd,
      onRoutePoint,
      onCommandResponse,
    };
  }, [onSessionStart, onSessionEnd, onRoutePoint, onCommandResponse]);

  // Store url and token in refs to use in callbacks without causing re-renders
  const configRef = useRef({ url, token, apiUrl });
  useEffect(() => {
    configRef.current = { url, token, apiUrl };
  }, [url, token, apiUrl]);

  // Fetch historical sessions from API
  const fetchHistoricalSessions = useCallback(async () => {
    if (historicalLoadedRef.current || !isMountedRef.current) return;

    try {
      const { apiUrl: baseUrl, token: authToken } = configRef.current;
      const response = await fetch(`${baseUrl || ''}/api/sessions?limit=100`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok && isMountedRef.current) {
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
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (!isMountedRef.current) return;

    switch (message.type) {
      case 'init':
        const newSessions = new Map<string, PlayerSession>();
        for (const session of message.activeSessions) {
          newSessions.set(session._id, session);
        }
        setSessions(newSessions);
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        fetchHistoricalSessions();
        break;

      case 'session_start':
        setSessions((prev) => {
          const next = new Map(prev);
          next.set(message.session._id, message.session);
          return next;
        });
        callbacksRef.current.onSessionStart?.(message.session);
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
        callbacksRef.current.onSessionEnd?.(message.sessionId, message.stats);
        break;

      case 'route_point':
        setSessions((prev) => {
          const next = new Map(prev);
          const session = next.get(message.sessionId);
          if (session) {
            session.path.push(message.point);
            session.lastSeenAt = message.point.t;
            session.stats.samples++;
            if (session.path.length > 1) {
              const lastPoint = session.path[session.path.length - 2];
              const dx = message.point.x - lastPoint.x;
              const dz = message.point.z - lastPoint.z;
              session.stats.distanceXZ += Math.sqrt(dx * dx + dz * dz);
            }
          }
          return next;
        });
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        callbacksRef.current.onRoutePoint?.(message.sessionId, message.point, message.conn);
        break;

      case 'time_update':
        if (typeof message.worldTime === 'number') {
          setWorldTime(message.worldTime);
        }
        break;

      case 'command_response':
        console.log('Command response:', message.success, message.message);
        callbacksRef.current.onCommandResponse?.(message.success, message.message);
        break;
    }
  }, [fetchHistoricalSessions]);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't connect if unmounted
    if (!isMountedRef.current) {
      return;
    }

    isConnectingRef.current = true;

    const { url: wsBaseUrl, token: wsToken } = configRef.current;
    const wsUrl = `${wsBaseUrl}?token=${encodeURIComponent(wsToken)}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        isConnectingRef.current = false;

        if (!isMountedRef.current) {
          return;
        }

        setConnected(false);
        wsRef.current = null;

        // Only reconnect if still mounted and not a normal closure
        if (isMountedRef.current && event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        // Only log error if we're still mounted (avoids noise from StrictMode cleanup)
        if (isMountedRef.current) {
          console.warn('WebSocket connection error - will retry');
        }
        isConnectingRef.current = false;
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
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnectingRef.current = false;
    }
  }, [handleMessage]);

  // Initial connection - only runs once on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Small delay to avoid StrictMode double-connection issues
    const connectTimer = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimer);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    // Reset state for fresh connection
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 100);
  }, [disconnect, connect]);

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
    reconnect,
    sendMessage,
  };
}
