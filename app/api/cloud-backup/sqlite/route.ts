import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { clearStorageCache } from '@/lib/storage';
import { closeLocalDb, DB_PATH } from '@/lib/local-db';

const SQLITE_HEADER = 'SQLite format 3';

function resolveDbPath(): string {
  return path.resolve(DB_PATH);
}

export async function GET() {
  try {
    const dbPath = resolveDbPath();
    const buffer = await fs.readFile(dbPath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="bladevault.sqlite"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Backup file is empty' }, { status: 400 });
    }

    if (buffer.subarray(0, SQLITE_HEADER.length).toString('utf8') !== SQLITE_HEADER) {
      return NextResponse.json({ error: 'Backup file is not a valid SQLite database' }, { status: 400 });
    }

    const dbPath = resolveDbPath();
    const dir = path.dirname(dbPath);
    const tempPath = `${dbPath}.restore.tmp`;
    const backupPath = `${dbPath}.before-restore.bak`;

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tempPath, buffer);

    closeLocalDb();
    clearStorageCache();

    try {
      await fs.rm(backupPath, { force: true });
      await fs.copyFile(dbPath, backupPath);
    } catch {
      // Ignore if the current database does not exist yet.
    }

    await fs.rename(tempPath, dbPath);

    return NextResponse.json({
      ok: true,
      size: buffer.length,
      restoredAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
