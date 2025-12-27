'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PlayerSession, RoutePoint } from '@/types';
import { MapSettings, MapDisplaySettings, defaultSettings, loadMapSettings, saveMapSettings } from './MapSettings';

interface MapCanvasProps {
  sessions: Map<string, PlayerSession>;
  selectedSessionId?: string | null;
  onSessionSelect?: (sessionId: string | null) => void;
  showGrid?: boolean;
  authToken?: string;
  currentDimension?: string;
  apiBaseUrl?: string;
  onRefreshTiles?: (dimension?: string) => void;
}

export interface MapCanvasRef {
  centerOnPosition: (x: number, z: number) => void;
  resetView: () => void;
}

interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface TileCache {
  [key: string]: HTMLImageElement | 'loading' | 'error' | 'empty';
}

const DIMENSION_COLORS: Record<string, string> = {
  'minecraft:overworld': '#4ade80',
  'minecraft:the_nether': '#f87171',
  'minecraft:the_end': '#c084fc',
};

// Map short dimension names to full IDs
const DIMENSION_FULL_IDS: Record<string, string> = {
  'overworld': 'minecraft:overworld',
  'the_nether': 'minecraft:the_nether',
  'the_end': 'minecraft:the_end',
};

const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const CHUNK_SIZE = 16; // Blocks per chunk

export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas({
  sessions,
  selectedSessionId,
  onSessionSelect,
  showGrid = true,
  authToken = '',
  currentDimension = 'overworld',
  apiBaseUrl = '',
  onRefreshTiles,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ offsetX: 0, offsetY: 0, scale: 2 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; z: number } | null>(null);
  const playerColorMap = useRef<Map<string, string>>(new Map());
  const tileCache = useRef<TileCache>({});
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const hasInitializedView = useRef(false);
  const loadingTilesCount = useRef(0);
  const worldBounds = useRef({ minX: 0, maxX: 0, minZ: 0, maxZ: 0, initialized: false });
  const [cacheBuster, setCacheBuster] = useState(0); // Force browser to re-fetch tiles
  const [displaySettings, setDisplaySettings] = useState<MapDisplaySettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);

  // Load display settings on mount
  useEffect(() => {
    setDisplaySettings(loadMapSettings());
  }, []);

  // Center on a specific world position with 4x zoom
  const centerOnPosition = useCallback((x: number, z: number) => {
    const scale = Math.max(transform.scale, 4); // At least 4x zoom (same as P button)
    setTransform({
      offsetX: -x * scale,
      offsetY: -z * scale,
      scale: scale,
    });
  }, [transform.scale]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    centerOnPosition,
    resetView: () => {
      if (worldBounds.current.initialized) {
        const bounds = worldBounds.current;
        const worldWidth = bounds.maxX - bounds.minX;
        const worldHeight = bounds.maxZ - bounds.minZ;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        const padding = 50;
        const availableWidth = dimensions.width - padding * 2;
        const availableHeight = dimensions.height - padding * 2;
        const scaleX = availableWidth / worldWidth;
        const scaleY = availableHeight / worldHeight;
        const scale = Math.min(scaleX, scaleY, 2);
        setTransform({
          offsetX: -centerX * scale,
          offsetY: -centerZ * scale,
          scale: Math.max(0.1, scale),
        });
      }
    },
  }), [centerOnPosition, dimensions]);

  // Assign colors to players
  const getPlayerColor = useCallback((playerUuid: string) => {
    if (!playerColorMap.current.has(playerUuid)) {
      const colorIndex = playerColorMap.current.size % PLAYER_COLORS.length;
      playerColorMap.current.set(playerUuid, PLAYER_COLORS[colorIndex]);
    }
    return playerColorMap.current.get(playerUuid)!;
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Clear tile cache and reset world bounds when dimension changes
  const prevDimensionRef = useRef(currentDimension);
  useEffect(() => {
    if (prevDimensionRef.current !== currentDimension) {
      // Clear tile cache for new dimension
      tileCache.current = {};
      worldBounds.current = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, initialized: false };
      setTilesLoaded(0);
      prevDimensionRef.current = currentDimension;
    }
  }, [currentDimension]);

  // Auto-center on first session (active or historical) when sessions load
  useEffect(() => {
    if (hasInitializedView.current) return;
    if (sessions.size === 0) return;

    const fullDimId = DIMENSION_FULL_IDS[currentDimension] || 'minecraft:overworld';

    // First try to find an active session in current dimension
    for (const [, session] of sessions) {
      if (session.active && session.path.length > 0) {
        const lastPoint = session.path[session.path.length - 1];
        if (lastPoint.dim === fullDimId) {
          setTransform({
            offsetX: -lastPoint.x * 2,
            offsetY: -lastPoint.z * 2,
            scale: 2,
          });
          hasInitializedView.current = true;
          return;
        }
      }
    }

    // Then try any session (including historical) with points in current dimension
    for (const [, session] of sessions) {
      if (session.path.length > 0) {
        // Find any point in the current dimension
        const pointInDim = session.path.find(p => p.dim === fullDimId);
        if (pointInDim) {
          setTransform({
            offsetX: -pointInDim.x * 2,
            offsetY: -pointInDim.z * 2,
            scale: 2,
          });
          hasInitializedView.current = true;

          // Initialize world bounds from all historical session points in this dimension
          const allPointsInDim = Array.from(sessions.values())
            .flatMap(s => s.path.filter(p => p.dim === fullDimId));

          if (allPointsInDim.length > 0) {
            const xs = allPointsInDim.map(p => p.x);
            const zs = allPointsInDim.map(p => p.z);
            worldBounds.current = {
              minX: Math.min(...xs) - 100,
              maxX: Math.max(...xs) + 100,
              minZ: Math.min(...zs) - 100,
              maxZ: Math.max(...zs) + 100,
              initialized: true,
            };
          }
          return;
        }
      }
    }
  }, [sessions, currentDimension]);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (x: number, z: number): [number, number] => {
      const screenX = (x * transform.scale) + transform.offsetX + dimensions.width / 2;
      const screenY = (z * transform.scale) + transform.offsetY + dimensions.height / 2;
      return [screenX, screenY];
    },
    [transform, dimensions]
  );

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): [number, number] => {
      const x = (screenX - dimensions.width / 2 - transform.offsetX) / transform.scale;
      const z = (screenY - dimensions.height / 2 - transform.offsetY) / transform.scale;
      return [x, z];
    },
    [transform, dimensions]
  );

  // Build API URL with optional base
  const getApiUrl = useCallback((path: string) => {
    if (apiBaseUrl) {
      return `${apiBaseUrl}${path}`;
    }
    return path;
  }, [apiBaseUrl]);

  // Load a tile image
  const loadTile = useCallback((dimension: string, chunkX: number, chunkZ: number) => {
    const key = `${dimension}:${chunkX}:${chunkZ}`;

    if (tileCache.current[key]) {
      return tileCache.current[key];
    }

    tileCache.current[key] = 'loading';
    loadingTilesCount.current++;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadingTilesCount.current--;
      // Check if it's a tiny transparent placeholder (1x1 or very small)
      if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
        tileCache.current[key] = 'empty';
      } else {
        tileCache.current[key] = img;
        // Update world bounds with this tile's position
        const worldX = chunkX * CHUNK_SIZE;
        const worldZ = chunkZ * CHUNK_SIZE;
        if (!worldBounds.current.initialized) {
          worldBounds.current = { minX: worldX, maxX: worldX + CHUNK_SIZE, minZ: worldZ, maxZ: worldZ + CHUNK_SIZE, initialized: true };
        } else {
          worldBounds.current.minX = Math.min(worldBounds.current.minX, worldX);
          worldBounds.current.maxX = Math.max(worldBounds.current.maxX, worldX + CHUNK_SIZE);
          worldBounds.current.minZ = Math.min(worldBounds.current.minZ, worldZ);
          worldBounds.current.maxZ = Math.max(worldBounds.current.maxZ, worldZ + CHUNK_SIZE);
        }
      }
      setTilesLoaded(prev => prev + 1); // Trigger re-render
    };
    img.onerror = () => {
      loadingTilesCount.current--;
      tileCache.current[key] = 'error';
      setTilesLoaded(prev => prev + 1); // Trigger re-render even on error
    };
    img.src = getApiUrl(`/api/tiles/${dimension}/${chunkX}/${chunkZ}?token=${encodeURIComponent(authToken)}&v=${cacheBuster}`);

    return 'loading';
  }, [authToken, getApiUrl, cacheBuster]);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Local coordinate conversion functions for this render
    const toScreen = (x: number, z: number): [number, number] => {
      const screenX = (x * transform.scale) + transform.offsetX + dimensions.width / 2;
      const screenY = (z * transform.scale) + transform.offsetY + dimensions.height / 2;
      return [screenX, screenY];
    };

    const toWorld = (screenX: number, screenY: number): [number, number] => {
      const x = (screenX - dimensions.width / 2 - transform.offsetX) / transform.scale;
      const z = (screenY - dimensions.height / 2 - transform.offsetY) / transform.scale;
      return [x, z];
    };

    // Draw tiles
    const [startX, startZ] = toWorld(0, 0);
    const [endX, endZ] = toWorld(dimensions.width, dimensions.height);

    const startChunkX = Math.floor(startX / CHUNK_SIZE) - 1;
    const startChunkZ = Math.floor(startZ / CHUNK_SIZE) - 1;
    const endChunkX = Math.ceil(endX / CHUNK_SIZE) + 1;
    const endChunkZ = Math.ceil(endZ / CHUNK_SIZE) + 1;

    // Clamp render range to world bounds if available (with some margin for new exploration)
    let renderStartX = startChunkX;
    let renderEndX = endChunkX;
    let renderStartZ = startChunkZ;
    let renderEndZ = endChunkZ;

    if (worldBounds.current.initialized) {
      const margin = 2; // chunks margin for loading adjacent tiles
      const boundsStartX = Math.floor(worldBounds.current.minX / CHUNK_SIZE) - margin;
      const boundsEndX = Math.ceil(worldBounds.current.maxX / CHUNK_SIZE) + margin;
      const boundsStartZ = Math.floor(worldBounds.current.minZ / CHUNK_SIZE) - margin;
      const boundsEndZ = Math.ceil(worldBounds.current.maxZ / CHUNK_SIZE) + margin;

      renderStartX = Math.max(startChunkX, boundsStartX);
      renderEndX = Math.min(endChunkX, boundsEndX);
      renderStartZ = Math.max(startChunkZ, boundsStartZ);
      renderEndZ = Math.min(endChunkZ, boundsEndZ);
    }

    // Safety limit to prevent too many tile requests
    const maxTiles = 1000;
    const totalTiles = (renderEndX - renderStartX + 1) * (renderEndZ - renderStartZ + 1);
    if (totalTiles > maxTiles) {
      // If still too many, limit from center
      const centerChunkX = Math.floor((renderStartX + renderEndX) / 2);
      const centerChunkZ = Math.floor((renderStartZ + renderEndZ) / 2);
      const chunksWide = renderEndX - renderStartX;
      const chunksHigh = renderEndZ - renderStartZ;
      const aspectRatio = chunksWide / Math.max(chunksHigh, 1);
      const maxChunksHigh = Math.floor(Math.sqrt(maxTiles / Math.max(aspectRatio, 0.1)));
      const maxChunksWide = Math.floor(maxChunksHigh * aspectRatio);
      const halfWidth = Math.floor(maxChunksWide / 2);
      const halfHeight = Math.floor(maxChunksHigh / 2);
      renderStartX = centerChunkX - halfWidth;
      renderEndX = centerChunkX + halfWidth;
      renderStartZ = centerChunkZ - halfHeight;
      renderEndZ = centerChunkZ + halfHeight;
    }

    ctx.imageSmoothingEnabled = transform.scale > 2;
    ctx.imageSmoothingQuality = 'high';
    const tileScreenSize = CHUNK_SIZE * transform.scale;

    for (let chunkX = renderStartX; chunkX <= renderEndX; chunkX++) {
      for (let chunkZ = renderStartZ; chunkZ <= renderEndZ; chunkZ++) {
        const tile = loadTile(currentDimension, chunkX, chunkZ);
        if (tile instanceof HTMLImageElement) {
          const worldX = chunkX * CHUNK_SIZE;
          const worldZ = chunkZ * CHUNK_SIZE;
          const [screenX, screenY] = toScreen(worldX, worldZ);
          ctx.drawImage(tile, screenX, screenY, tileScreenSize, tileScreenSize);
        }
      }
    }

    // Draw grid
    if (showGrid) {
      drawGrid(ctx, toWorld, toScreen);
    }

    // Draw routes - filter by current dimension
    const fullDimId = DIMENSION_FULL_IDS[currentDimension] || 'minecraft:overworld';
    sessions.forEach((session, sessionId) => {
      const isSelected = sessionId === selectedSessionId;
      const isHovered = sessionId === hoveredSession;
      drawRoute(ctx, session, isSelected, isHovered, toScreen, fullDimId, displaySettings);
    });

  }, [sessions, transform, dimensions, selectedSessionId, hoveredSession, showGrid, tilesLoaded, currentDimension, loadTile, displaySettings]);

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    toWorld: (x: number, y: number) => [number, number],
    toScreen: (x: number, z: number) => [number, number]
  ) => {
    const gridSize = getGridSize();
    const [startX, startZ] = toWorld(0, 0);
    const [endX, endZ] = toWorld(dimensions.width, dimensions.height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    // Vertical lines
    const startGridX = Math.floor(startX / gridSize) * gridSize;
    for (let x = startGridX; x <= endX; x += gridSize) {
      const [screenX] = toScreen(x, 0);
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, dimensions.height);
      ctx.stroke();
    }

    // Horizontal lines
    const startGridZ = Math.floor(startZ / gridSize) * gridSize;
    for (let z = startGridZ; z <= endZ; z += gridSize) {
      const [, screenY] = toScreen(0, z);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(dimensions.width, screenY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Origin cross
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    const [originX, originY] = toScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(originX - 10, originY);
    ctx.lineTo(originX + 10, originY);
    ctx.moveTo(originX, originY - 10);
    ctx.lineTo(originX, originY + 10);
    ctx.stroke();
  };

  const getGridSize = () => {
    if (transform.scale < 0.1) return 1000;
    if (transform.scale < 0.5) return 500;
    if (transform.scale < 1) return 100;
    if (transform.scale < 5) return 50;
    return 16;
  };

  const drawRoute = (
    ctx: CanvasRenderingContext2D,
    session: PlayerSession,
    isSelected: boolean,
    isHovered: boolean,
    toScreen: (x: number, z: number) => [number, number],
    dimensionFilter: string,
    settings: MapDisplaySettings
  ) => {
    if (session.path.length === 0) return;

    // Skip inactive sessions if setting is off
    if (!session.active && !settings.showInactivePaths) return;

    const color = getPlayerColor(session.playerUuid);

    // Filter points by current dimension
    const pointsInDimension = session.path.filter(p => p.dim === dimensionFilter);

    if (pointsInDimension.length === 0) return;

    // Only draw the path/route when the player is selected
    if (isSelected && pointsInDimension.length >= 2) {
      const baseWidth = settings.routeWidth;
      const lineWidth = baseWidth + 1;

      ctx.beginPath();
      ctx.strokeStyle = settings.routeColor;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const [startX, startY] = toScreen(pointsInDimension[0].x, pointsInDimension[0].z);
      ctx.moveTo(startX, startY);

      for (let i = 1; i < pointsInDimension.length; i++) {
        const [x, y] = toScreen(pointsInDimension[i].x, pointsInDimension[i].z);
        ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw direction indicators along the path
      if (settings.showArrows) {
        const minPixelDistance = 60; // Minimum pixels between arrows
        let accumulatedDistance = 0;

        for (let i = 1; i < pointsInDimension.length; i++) {
          const [x1, y1] = toScreen(pointsInDimension[i - 1].x, pointsInDimension[i - 1].z);
          const [x2, y2] = toScreen(pointsInDimension[i].x, pointsInDimension[i].z);

          const segmentDistance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          accumulatedDistance += segmentDistance;

          // Draw arrow when we've accumulated enough distance
          if (accumulatedDistance >= minPixelDistance) {
            accumulatedDistance = 0;

            // Calculate midpoint of this segment
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // Calculate angle
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const chevronSize = settings.arrowSize;

            // Draw chevron (two lines forming an arrow shape)
            ctx.beginPath();
            ctx.moveTo(
              midX - chevronSize * Math.cos(angle - Math.PI / 4),
              midY - chevronSize * Math.sin(angle - Math.PI / 4)
            );
            ctx.lineTo(midX, midY);
            ctx.lineTo(
              midX - chevronSize * Math.cos(angle + Math.PI / 4),
              midY - chevronSize * Math.sin(angle + Math.PI / 4)
            );
            ctx.strokeStyle = settings.arrowColor;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
        }
      }

      // Draw start marker (small circle)
      ctx.beginPath();
      ctx.arc(startX, startY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e'; // Green for start
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw end arrow (if not active session, since active has the player marker)
      if (!session.active && pointsInDimension.length >= 2) {
        const lastPoint = pointsInDimension[pointsInDimension.length - 1];
        const prevPoint = pointsInDimension[pointsInDimension.length - 2];
        const [endX, endY] = toScreen(lastPoint.x, lastPoint.z);
        const [prevX, prevY] = toScreen(prevPoint.x, prevPoint.z);

        // Calculate angle
        const angle = Math.atan2(endY - prevY, endX - prevX);
        const arrowSize = 10;

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 6),
          endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 6),
          endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#ef4444'; // Red for end
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Draw current position marker for active sessions in this dimension
    if (session.active && session.path.length > 0) {
      const lastPoint = session.path[session.path.length - 1];

      // Only show marker if player is currently in this dimension
      if (lastPoint.dim === dimensionFilter) {
        const [x, y] = toScreen(lastPoint.x, lastPoint.z);

        // Outer glow (larger when selected or hovered)
        const glowSize = isSelected ? settings.glowSize * 1.5 : isHovered ? settings.glowSize * 1.2 : settings.glowSize;
        if (glowSize > 0) {
          ctx.beginPath();
          ctx.arc(x, y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = color + '40';
          ctx.fill();
        }

        // Inner dot (larger when selected)
        const markerSize = isSelected ? settings.markerSize * 1.3 : settings.markerSize;
        ctx.beginPath();
        ctx.arc(x, y, markerSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : '#ffffff80';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // Player name label
        if (settings.showLabels) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${settings.labelSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3;
          ctx.fillText(session.playerName, x, y - markerSize - 6);
          ctx.shadowBlur = 0;
        }
      }
    }
  };

  // Center on first active player in current dimension with good zoom
  const centerOnPlayer = () => {
    const fullDimId = DIMENSION_FULL_IDS[currentDimension] || 'minecraft:overworld';

    // First try to find a player in the current dimension
    for (const [, session] of sessions) {
      if (session.active && session.path.length > 0) {
        const lastPoint = session.path[session.path.length - 1];
        if (lastPoint.dim === fullDimId) {
          const targetScale = Math.max(transform.scale, 4);
          setTransform({
            offsetX: -lastPoint.x * targetScale,
            offsetY: -lastPoint.z * targetScale,
            scale: targetScale,
          });
          return;
        }
      }
    }

    // If no player in current dimension, center on any active player
    for (const [, session] of sessions) {
      if (session.active && session.path.length > 0) {
        const lastPoint = session.path[session.path.length - 1];
        const targetScale = Math.max(transform.scale, 4);
        setTransform({
          offsetX: -lastPoint.x * targetScale,
          offsetY: -lastPoint.z * targetScale,
          scale: targetScale,
        });
        break;
      }
    }
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  // Clamp transform to world bounds with some padding
  const clampTransform = useCallback((newTransform: Transform): Transform => {
    if (!worldBounds.current.initialized) return newTransform;

    const bounds = worldBounds.current;
    const padding = 100; // Small padding beyond explored area

    // Calculate the center position in world coordinates
    const centerX = -newTransform.offsetX / newTransform.scale;
    const centerZ = -newTransform.offsetY / newTransform.scale;

    // Clamp to bounds
    const clampedX = Math.max(bounds.minX - padding, Math.min(bounds.maxX + padding, centerX));
    const clampedZ = Math.max(bounds.minZ - padding, Math.min(bounds.maxZ + padding, centerZ));

    return {
      ...newTransform,
      offsetX: -clampedX * newTransform.scale,
      offsetY: -clampedZ * newTransform.scale,
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setTransform((prev) => clampTransform({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    // Check for hovering over sessions
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldZ] = screenToWorld(mouseX, mouseY);

    // Update mouse world position for display
    setMouseWorldPos({ x: Math.round(worldX), z: Math.round(worldZ) });

    let nearestSession: string | null = null;
    let nearestDistance = 20 / transform.scale; // 20 pixels threshold

    sessions.forEach((session, sessionId) => {
      if (!session.active) return;
      const lastPoint = session.path[session.path.length - 1];
      if (!lastPoint) return;

      const dx = lastPoint.x - worldX;
      const dz = lastPoint.z - worldZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSession = sessionId;
      }
    });

    setHoveredSession(nearestSession);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredSession(null);
    setMouseWorldPos(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * delta, 0.01), 50);

    // Zoom towards mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left - dimensions.width / 2;
    const mouseY = e.clientY - rect.top - dimensions.height / 2;

    setTransform((prev) => ({
      offsetX: mouseX - (mouseX - prev.offsetX) * (newScale / prev.scale),
      offsetY: mouseY - (mouseY - prev.offsetY) * (newScale / prev.scale),
      scale: newScale,
    }));
  };

  const handleClick = () => {
    if (hoveredSession) {
      onSessionSelect?.(hoveredSession);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Center on double-clicked position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldZ] = screenToWorld(mouseX, mouseY);

    setTransform((prev) => ({
      ...prev,
      offsetX: -worldX * prev.scale,
      offsetY: -worldZ * prev.scale,
    }));
  };

  const resetView = () => {
    // If we have world bounds, fit the entire explored area in view
    if (worldBounds.current.initialized) {
      const bounds = worldBounds.current;
      const worldWidth = bounds.maxX - bounds.minX;
      const worldHeight = bounds.maxZ - bounds.minZ;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerZ = (bounds.minZ + bounds.maxZ) / 2;

      // Calculate scale to fit the world in the viewport with some padding
      const padding = 50; // pixels of padding
      const availableWidth = dimensions.width - padding * 2;
      const availableHeight = dimensions.height - padding * 2;

      const scaleX = availableWidth / worldWidth;
      const scaleY = availableHeight / worldHeight;
      const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom max

      setTransform({
        offsetX: -centerX * scale,
        offsetY: -centerZ * scale,
        scale: Math.max(0.1, scale), // Minimum 0.1x zoom
      });
    } else {
      // No bounds yet, just go to origin
      setTransform(prev => ({ ...prev, offsetX: 0, offsetY: 0 }));
    }
  };

  // Get selected player's current position
  const getSelectedPlayerPosition = useCallback((): { x: number; z: number } | null => {
    if (!selectedSessionId) return null;
    const session = sessions.get(selectedSessionId);
    if (session && session.path.length > 0) {
      const lastPoint = session.path[session.path.length - 1];
      return { x: lastPoint.x, z: lastPoint.z };
    }
    return null;
  }, [selectedSessionId, sessions]);

  // Zoom in/out centered on selected player or viewport center
  const zoomIn = useCallback(() => {
    const playerPos = getSelectedPlayerPosition();
    const newScale = transform.scale * 1.5;

    if (playerPos) {
      // Zoom centered on selected player
      setTransform({
        offsetX: -playerPos.x * newScale,
        offsetY: -playerPos.z * newScale,
        scale: newScale,
      });
    } else {
      // Zoom centered on viewport
      setTransform(prev => ({ ...prev, scale: newScale }));
    }
  }, [transform.scale, getSelectedPlayerPosition]);

  const zoomOut = useCallback(() => {
    const playerPos = getSelectedPlayerPosition();
    const newScale = transform.scale / 1.5;

    if (playerPos) {
      // Zoom centered on selected player
      setTransform({
        offsetX: -playerPos.x * newScale,
        offsetY: -playerPos.z * newScale,
        scale: newScale,
      });
    } else {
      // Zoom centered on viewport
      setTransform(prev => ({ ...prev, scale: newScale }));
    }
  }, [transform.scale, getSelectedPlayerPosition]);

  // Refresh tiles - tell server to re-render and clear local cache
  const refreshTiles = () => {
    // Send message to server to re-render tiles for current dimension
    onRefreshTiles?.(currentDimension);

    // Clear the local tile cache
    tileCache.current = {};
    worldBounds.current = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, initialized: false };
    setTilesLoaded(0);

    // Increment cache buster to force browser to re-fetch all tiles
    setCacheBuster(prev => prev + 1);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-slate-900">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center cursor-pointer"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center cursor-pointer"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center text-xs cursor-pointer"
          title="Fit entire map"
        >
          O
        </button>
        <button
          onClick={centerOnPlayer}
          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center text-xs cursor-pointer"
          title="Center on player"
        >
          P
        </button>
        <button
          onClick={refreshTiles}
          className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded flex items-center justify-center text-xs cursor-pointer"
          title="Refresh map tiles (re-render all)"
        >
          R
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-8 h-8 ${showSettings ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'} text-white rounded flex items-center justify-center cursor-pointer`}
          title="Display settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Map Display Settings Panel */}
      <MapSettings
        settings={displaySettings}
        onChange={setDisplaySettings}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Mouse coordinates and zoom */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded px-3 py-1.5 text-sm text-slate-200 font-mono">
        {mouseWorldPos ? (
          <span>X: {mouseWorldPos.x}, Z: {mouseWorldPos.z}</span>
        ) : (
          <span>Zoom: {transform.scale.toFixed(2)}x</span>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 rounded p-2 text-xs text-slate-300">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-green-400"></span>
          <span>Overworld</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-red-400"></span>
          <span>Nether</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-400"></span>
          <span>End</span>
        </div>
      </div>
    </div>
  );
});
