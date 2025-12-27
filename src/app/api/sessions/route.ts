import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const playerUuid = searchParams.get('playerUuid');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  const storage = getStorageProvider();

  try {
    let sessions;

    if (playerUuid) {
      sessions = await storage.getSessionsByPlayer(playerUuid, limit, offset);
    } else if (startTime && endTime) {
      sessions = await storage.getSessionsByTimeRange(
        parseInt(startTime, 10),
        parseInt(endTime, 10),
        limit,
        offset
      );
    } else {
      sessions = await storage.getSessions(limit, offset);
    }

    const total = await storage.countSessions();

    return NextResponse.json({
      sessions,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
