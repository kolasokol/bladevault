import { execFile } from 'child_process';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { clearStorageCache } from '@/lib/storage';
import { beginLocalRestore, closeLocalDb, DATA_DIR, endLocalRestore } from '@/lib/local-db';

const execFileAsync = promisify(execFile);

function shouldIgnoreBackupEntry(name: string): boolean {
  return name === '.DS_Store' || name === '__MACOSX' || name.startsWith('._');
}

function resolveDataDir(): string {
  return path.resolve(DATA_DIR);
}

function isTarGzipFile(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

async function createArchive(sourceDir: string, outputPath: string) {
  await execFileAsync('tar', [
    '--exclude=.DS_Store',
    '--exclude=__MACOSX',
    '--exclude=._*',
    '-czf',
    outputPath,
    '-C',
    path.dirname(sourceDir),
    path.basename(sourceDir),
  ]);
}

async function extractArchive(archivePath: string, outputDir: string) {
  await execFileAsync('tar', ['-xzf', archivePath, '-C', outputDir]);
}

async function validateArchive(archivePath: string) {
  await execFileAsync('gzip', ['-t', archivePath]);
}

async function validateSqliteFile(dbPath: string) {
  await execFileAsync('node', [
    '-e',
    `
      const Database = require('better-sqlite3');
      const db = new Database(process.argv[1], { readonly: true });
      const row = db.prepare("PRAGMA integrity_check;").get();
      db.close();
      if (!row || Object.values(row)[0] !== 'ok') {
        process.exit(2);
      }
    `,
    dbPath,
  ]);
}

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listDirectoryEntries(dirPath: string) {
  return await fs.readdir(dirPath, { withFileTypes: true });
}

async function moveDirectoryContents(sourceDir: string, targetDir: string) {
  await ensureDirectory(targetDir);
  const entries = (await listDirectoryEntries(sourceDir)).filter((entry) => !shouldIgnoreBackupEntry(entry.name));

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EXDEV')) {
        throw error;
      }

      await fs.cp(sourcePath, targetPath, {
        recursive: true,
        force: true,
      });
      await fs.rm(sourcePath, {
        recursive: true,
        force: true,
      });
    }
  }
}

async function copyDirectoryContents(sourceDir: string, targetDir: string) {
  await ensureDirectory(targetDir);
  const entries = (await listDirectoryEntries(sourceDir)).filter((entry) => !shouldIgnoreBackupEntry(entry.name));

  for (const entry of entries) {
    await fs.cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

async function removeDirectoryContents(dirPath: string) {
  const entries = (await listDirectoryEntries(dirPath)).filter((entry) => !shouldIgnoreBackupEntry(entry.name));

  for (const entry of entries) {
    await fs.rm(path.join(dirPath, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

async function restoreArchiveFromPath(archivePath: string) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bladevault-backup-import-'));
  const extractRoot = path.join(tempRoot, 'extract');

  try {
    await fs.mkdir(extractRoot, { recursive: true });
    await validateArchive(archivePath);
    await extractArchive(archivePath, extractRoot);

    const extractedDataDir = path.join(extractRoot, path.basename(resolveDataDir()));
    const extractedDbPath = path.join(extractedDataDir, 'bladevault.sqlite');

    await fs.access(extractedDataDir);
    await fs.access(extractedDbPath);
    await validateSqliteFile(extractedDbPath);

    const currentDataDir = resolveDataDir();
    const backupDataDir = `${currentDataDir}.before-restore-${Date.now()}.bak`;

    beginLocalRestore();
    closeLocalDb();
    clearStorageCache();

    try {
      try {
        await fs.rm(backupDataDir, { recursive: true, force: true });
        await ensureDirectory(currentDataDir);
        await moveDirectoryContents(currentDataDir, backupDataDir);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
          throw error;
        }
      }

      await fs.mkdir(path.dirname(currentDataDir), { recursive: true });

      try {
        await copyDirectoryContents(extractedDataDir, currentDataDir);
        await validateSqliteFile(path.join(currentDataDir, 'bladevault.sqlite'));
      } catch (error) {
        await removeDirectoryContents(currentDataDir);

        try {
          await moveDirectoryContents(backupDataDir, currentDataDir);
        } catch {
          // Best effort rollback if the restore copy fails.
        }

        throw error;
      }
    } finally {
      endLocalRestore();
    }

    const stat = await fs.stat(archivePath);
    return {
      ok: true,
      size: stat.size,
      restoredAt: new Date().toISOString(),
      dataDir: currentDataDir,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function downloadArchiveToPath(downloadUrl: string, accessToken: string, outputPath: string) {
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      // ignore
    }
    throw new Error(details || `Backup download failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error('Backup server returned an empty response body.');
  }

  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(outputPath));
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bladevault-backup-upload-import-'));
  const archivePath = path.join(tempRoot, 'bladevault-data.tar.gz');

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Backup archive is empty' }, { status: 400 });
    }

    if (!isTarGzipFile(buffer)) {
      return NextResponse.json({ error: 'Backup file is not a valid tar.gz archive' }, { status: 400 });
    }

    await fs.writeFile(archivePath, buffer);
    const result = await restoreArchiveFromPath(archivePath);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function POST(request: Request) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bladevault-backup-remote-restore-'));
  const archivePath = path.join(tempRoot, 'bladevault-data.tar.gz');

  try {
    const body = (await request.json()) as {
      backupUrl?: string;
      accessToken?: string;
    };

    const backupUrl = typeof body.backupUrl === 'string' ? body.backupUrl.trim() : '';
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

    if (!backupUrl) {
      return NextResponse.json({ error: 'backupUrl is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
    }

    const downloadUrl = new URL('/backup/latest', backupUrl).toString();
    await downloadArchiveToPath(downloadUrl, accessToken, archivePath);

    const result = await restoreArchiveFromPath(archivePath);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
