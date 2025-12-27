import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storage = getStorageProvider();

  try {
    const players = await storage.getPlayers();

    return NextResponse.json({
      players,
      online: players.filter(p => p.online).length,
      total: players.length,
    });
  } catch (error) {
    console.error('Failed to fetch players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
