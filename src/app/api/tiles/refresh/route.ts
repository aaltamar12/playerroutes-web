import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = process.env.JSON_STORAGE_DIR || '../playerroutes-mod/playerroutes-data';

const TILES_DIR = path.isAbsolute(STORAGE_DIR)
  ? path.join(STORAGE_DIR, 'tiles')
  : path.resolve(process.cwd(), STORAGE_DIR, 'tiles');

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dimension, all } = body;

    if (all) {
      // Delete all tiles for all dimensions
      if (fs.existsSync(TILES_DIR)) {
        const dimensions = fs.readdirSync(TILES_DIR);
        let count = 0;
        for (const dim of dimensions) {
          const dimPath = path.join(TILES_DIR, dim);
          if (fs.statSync(dimPath).isDirectory()) {
            const files = fs.readdirSync(dimPath).filter(f => f.endsWith('.png'));
            for (const file of files) {
              fs.unlinkSync(path.join(dimPath, file));
              count++;
            }
          }
        }
        return NextResponse.json({ success: true, deleted: count, message: `Deleted ${count} tiles from all dimensions` });
      }
    } else if (dimension) {
      // Delete tiles for specific dimension
      const dimPath = path.join(TILES_DIR, dimension);
      if (fs.existsSync(dimPath)) {
        const files = fs.readdirSync(dimPath).filter(f => f.endsWith('.png'));
        for (const file of files) {
          fs.unlinkSync(path.join(dimPath, file));
        }
        return NextResponse.json({ success: true, deleted: files.length, message: `Deleted ${files.length} tiles from ${dimension}` });
      }
    }

    return NextResponse.json({ success: true, deleted: 0, message: 'No tiles to delete' });
  } catch (error) {
    console.error('Failed to refresh tiles:', error);
    return NextResponse.json({ error: 'Failed to refresh tiles' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Alias for POST with all=true
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (fs.existsSync(TILES_DIR)) {
      const dimensions = fs.readdirSync(TILES_DIR);
      let count = 0;
      for (const dim of dimensions) {
        const dimPath = path.join(TILES_DIR, dim);
        if (fs.statSync(dimPath).isDirectory()) {
          const files = fs.readdirSync(dimPath).filter(f => f.endsWith('.png'));
          for (const file of files) {
            fs.unlinkSync(path.join(dimPath, file));
            count++;
          }
        }
      }
      return NextResponse.json({ success: true, deleted: count, message: `Deleted ${count} tiles` });
    }
    return NextResponse.json({ success: true, deleted: 0, message: 'No tiles to delete' });
  } catch (error) {
    console.error('Failed to delete tiles:', error);
    return NextResponse.json({ error: 'Failed to delete tiles' }, { status: 500 });
  }
}
