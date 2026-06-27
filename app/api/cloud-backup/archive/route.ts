import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { clearStorageCache } from '@/lib/storage';
import { closeLocalDb, DATA_DIR } from '@/lib/local-db';

const execFileAsync = promisify(execFile);

function resolveDataDir(): string {
  return path.resolve(DATA_DIR);
}

function isTarGzipFile(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

async function createArchive(sourceDir: string, outputPath: string) {
  await execFileAsync('tar', ['-czf', outputPath, '-C', path.dirname(sourceDir), path.basename(sourceDir)]);
}

async function extractArchive(archivePath: string, outputDir: string) {
  await execFileAsync('tar', ['-xzf', archivePath, '-C', outputDir]);
}

export async function GET() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bladevault-backup-export-'));
  const archivePath = path.join(tempRoot, 'bladevault-data.tar.gz');

  try {
    const dataDir = resolveDataDir();
    await fs.mkdir(dataDir, { recursive: true });

    closeLocalDb();
    clearStorageCache();

    await createArchive(dataDir, archivePath);
    const buffer = await fs.readFile(archivePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="bladevault-data.tar.gz"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function PUT(request: Request) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bladevault-backup-import-'));
  const archivePath = path.join(tempRoot, 'bladevault-data.tar.gz');
  const extractRoot = path.join(tempRoot, 'extract');

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Backup archive is empty' }, { status: 400 });
    }

    if (!isTarGzipFile(buffer)) {
      return NextResponse.json({ error: 'Backup file is not a valid tar.gz archive' }, { status: 400 });
    }

    await fs.mkdir(extractRoot, { recursive: true });
    await fs.writeFile(archivePath, buffer);
    await extractArchive(archivePath, extractRoot);

    const extractedDataDir = path.join(extractRoot, path.basename(resolveDataDir()));
    const extractedDbPath = path.join(extractedDataDir, 'bladevault.sqlite');

    await fs.access(extractedDataDir);
    await fs.access(extractedDbPath);

    const currentDataDir = resolveDataDir();
    const backupDataDir = `${currentDataDir}.before-restore-${Date.now()}.bak`;

    closeLocalDb();
    clearStorageCache();

    try {
      await fs.rm(backupDataDir, { recursive: true, force: true });
      await fs.rename(currentDataDir, backupDataDir);
    } catch {
      // Ignore if the current data directory does not exist yet.
    }

    await fs.mkdir(path.dirname(currentDataDir), { recursive: true });
    await fs.rename(extractedDataDir, currentDataDir);

    return NextResponse.json({
      ok: true,
      size: buffer.length,
      restoredAt: new Date().toISOString(),
      dataDir: currentDataDir,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
