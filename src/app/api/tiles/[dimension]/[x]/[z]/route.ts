import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = process.env.JSON_STORAGE_DIR || '../playerroutes-mod/playerroutes-data';

// Use absolute path if provided, otherwise resolve relative to cwd
const TILES_DIR = path.isAbsolute(STORAGE_DIR)
  ? path.join(STORAGE_DIR, 'tiles')
  : path.resolve(process.cwd(), STORAGE_DIR, 'tiles');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dimension: string; x: string; z: string }> }
) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dimension, x, z } = await params;

  const tilePath = path.join(
    TILES_DIR,
    dimension,
    `${x}_${z}.png`
  );

  try {
    if (!fs.existsSync(tilePath)) {
      // Return transparent 1x1 PNG for missing tiles
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      return new NextResponse(transparentPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache', // Don't cache missing tiles
        },
      });
    }

    const fileBuffer = fs.readFileSync(tilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=1', // Cache for 1 second
      },
    });
  } catch (error) {
    console.error('Failed to read tile:', error);
    return NextResponse.json({ error: 'Failed to read tile' }, { status: 500 });
  }
}
