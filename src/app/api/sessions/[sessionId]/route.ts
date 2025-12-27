import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;
  const storage = getStorageProvider();

  try {
    const session = await storage.getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
