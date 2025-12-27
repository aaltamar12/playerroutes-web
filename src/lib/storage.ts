import { PlayerSession, Player } from '@/types';
import fs from 'fs';
import path from 'path';

const JSON_STORAGE_DIR = process.env.JSON_STORAGE_DIR || '../playerroutes-mod/playerroutes-data';

interface StorageProvider {
  getSessions(limit?: number, offset?: number): Promise<PlayerSession[]>;
  getSession(sessionId: string): Promise<PlayerSession | null>;
  getSessionsByPlayer(playerUuid: string, limit?: number, offset?: number): Promise<PlayerSession[]>;
  getSessionsByTimeRange(startTime: number, endTime: number, limit?: number, offset?: number): Promise<PlayerSession[]>;
  getPlayers(): Promise<Player[]>;
  countSessions(): Promise<number>;
}

class JsonStorageProvider implements StorageProvider {
  private sessionsCache: Map<string, PlayerSession> = new Map();
  private lastLoad: number = 0;
  private cacheTTL: number = 5000; // 5 seconds

  private async loadSessions(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoad < this.cacheTTL && this.sessionsCache.size > 0) {
      return;
    }

    const storageDir = path.resolve(process.cwd(), JSON_STORAGE_DIR);

    if (!fs.existsSync(storageDir)) {
      console.warn(`Storage directory does not exist: ${storageDir}`);
      return;
    }

    const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.json'));

    this.sessionsCache.clear();
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(storageDir, file), 'utf-8');
        const session = JSON.parse(content) as PlayerSession;
        this.sessionsCache.set(session._id, session);
      } catch (e) {
        console.error(`Failed to load session file ${file}:`, e);
      }
    }

    this.lastLoad = now;
  }

  async getSessions(limit = 50, offset = 0): Promise<PlayerSession[]> {
    await this.loadSessions();
    return Array.from(this.sessionsCache.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(offset, offset + limit);
  }

  async getSession(sessionId: string): Promise<PlayerSession | null> {
    await this.loadSessions();
    return this.sessionsCache.get(sessionId) || null;
  }

  async getSessionsByPlayer(playerUuid: string, limit = 50, offset = 0): Promise<PlayerSession[]> {
    await this.loadSessions();
    return Array.from(this.sessionsCache.values())
      .filter(s => s.playerUuid === playerUuid)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(offset, offset + limit);
  }

  async getSessionsByTimeRange(startTime: number, endTime: number, limit = 50, offset = 0): Promise<PlayerSession[]> {
    await this.loadSessions();
    return Array.from(this.sessionsCache.values())
      .filter(s => s.startedAt >= startTime && s.startedAt <= endTime)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(offset, offset + limit);
  }

  async getPlayers(): Promise<Player[]> {
    await this.loadSessions();
    const playerMap = new Map<string, Player>();

    for (const session of this.sessionsCache.values()) {
      const existing = playerMap.get(session.playerUuid);
      if (!existing) {
        playerMap.set(session.playerUuid, {
          uuid: session.playerUuid,
          name: session.playerName,
          online: session.active,
          lastSeenAt: session.lastSeenAt,
          currentSessionId: session.active ? session._id : undefined,
          sessionCount: 1,
        });
      } else {
        existing.sessionCount++;
        if (session.lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = session.lastSeenAt;
          existing.name = session.playerName;
        }
        if (session.active) {
          existing.online = true;
          existing.currentSessionId = session._id;
        }
      }
    }

    return Array.from(playerMap.values()).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return b.lastSeenAt - a.lastSeenAt;
    });
  }

  async countSessions(): Promise<number> {
    await this.loadSessions();
    return this.sessionsCache.size;
  }
}

// Singleton storage provider
let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    // Could add MongoDB support here based on env vars
    storageProvider = new JsonStorageProvider();
  }
  return storageProvider;
}
