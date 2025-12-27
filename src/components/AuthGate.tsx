'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface AuthGateProps {
  children: ReactNode;
  onAuthenticated: (token: string, serverConfig: ServerConfig) => void;
}

export interface ServerConfig {
  wsUrl: string;
  apiUrl: string;
}

const STORAGE_KEY = 'playerroutes_auth_token';
const SERVER_CONFIG_KEY = 'playerroutes_server_config';
const DEFAULT_WS_PORT = 8765;

// Auto-detect WebSocket URL based on current hostname
function getAutoDetectedWsUrl(): string {
  if (typeof window === 'undefined') {
    return `ws://localhost:${DEFAULT_WS_PORT}`;
  }

  const hostname = window.location.hostname;
  const isSecure = window.location.protocol === 'https:';
  const wsProtocol = isSecure ? 'wss' : 'ws';

  return `${wsProtocol}://${hostname}:${DEFAULT_WS_PORT}`;
}

function buildConfig(): ServerConfig {
  return {
    wsUrl: getAutoDetectedWsUrl(),
    apiUrl: '', // Always same-origin for API
  };
}

export function AuthGate({ children, onAuthenticated }: AuthGateProps) {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  // Use refs to track state in WebSocket callbacks (avoids stale closure issues)
  const authSuccessRef = useRef(false);

  useEffect(() => {
    // Check for stored token and validate it
    const storedToken = localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      validateTokenWithWebSocket(storedToken);
    } else {
      setLoading(false);
    }

    // Cleanup WebSocket on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  /**
   * Validate token by attempting to connect to the mod's WebSocket.
   * If the connection succeeds and we receive an 'init' message, the token is valid.
   */
  const validateTokenWithWebSocket = (tokenToValidate: string) => {
    setLoading(true);
    setValidating(true);
    setError('');
    authSuccessRef.current = false;

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const config = buildConfig();
    const wsUrlWithToken = `${config.wsUrl}?token=${encodeURIComponent(tokenToValidate)}`;

    try {
      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        if (!authSuccessRef.current) {
          ws.close();
          setError('Connection timeout. Make sure the Minecraft mod is running.');
          setLoading(false);
          setValidating(false);
          localStorage.removeItem(STORAGE_KEY);
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        // Connection opened, waiting for init message to confirm auth
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'init') {
            // Token is valid! The mod accepted our connection
            clearTimeout(timeout);
            authSuccessRef.current = true;
            localStorage.setItem(STORAGE_KEY, tokenToValidate);
            localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));
            setAuthenticated(true);
            setLoading(false);
            setValidating(false);
            // Close this validation connection - the app will create its own
            ws.close();
            wsRef.current = null;
            onAuthenticated(tokenToValidate, config);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!authSuccessRef.current) {
          setError('Connection failed. Check if the Minecraft mod is running.');
          setLoading(false);
          setValidating(false);
          localStorage.removeItem(STORAGE_KEY);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        // Only handle errors if auth wasn't successful
        if (!authSuccessRef.current) {
          // Connection closed without successful auth
          if (event.code === 1008 || event.code === 4001 || event.code === 4003) {
            // Policy violation or custom auth error codes
            setError('Invalid token. Check your token in playerroutes-server.toml');
          } else if (event.code !== 1000) {
            // Abnormal closure
            setError('Connection closed unexpectedly. Make sure the mod is running.');
          }
          setLoading(false);
          setValidating(false);
          localStorage.removeItem(STORAGE_KEY);
        }
      };
    } catch {
      setError('Failed to connect. Check the WebSocket URL.');
      setLoading(false);
      setValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && !validating) {
      validateTokenWithWebSocket(token.trim());
    }
  };

  // Get auto-detected URL for display
  const wsUrl = typeof window !== 'undefined' ? getAutoDetectedWsUrl() : `ws://localhost:${DEFAULT_WS_PORT}`;

  // Show loading screen while checking stored token or validating
  const hasStoredToken = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY);
  const showLoadingScreen = loading || (validating && hasStoredToken);

  if (showLoadingScreen) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-300">Connecting to server...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-8 w-full max-w-md shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Player Routes</h1>
            <p className="text-slate-400">Connect to your Minecraft server</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-300 mb-1">
                Admin Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your token"
                  className="w-full px-4 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  disabled={validating}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showToken ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Connection info */}
            <div className="bg-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400">Connecting to:</p>
              <p className="text-sm text-white font-mono truncate">{wsUrl}</p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={validating || !token.trim()}
              className={`w-full py-2 px-4 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                validating || !token.trim()
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {validating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Connecting to mod...
                </span>
              ) : (
                'Connect'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            <p>Token is configured in <code className="bg-slate-700 px-1 rounded">playerroutes-server.toml</code></p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
