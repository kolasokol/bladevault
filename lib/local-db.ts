import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DB_PATH = 'data/bladevault.sqlite';

let db: Database.Database | null = null;

export function getLocalDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

export function closeLocalDb(): void {
  if (!db) return;
  db.close();
  db = null;
}

function migrateSchema(database: Database.Database) {
  const columns = database
    .prepare("SELECT name FROM pragma_table_info('knives')")
    .all() as Array<{ name: string }>;
  const hasSourceUrl = columns.some((col) => col.name === 'source_url');
  if (!hasSourceUrl) {
    database.exec(`ALTER TABLE knives ADD COLUMN source_url TEXT NOT NULL DEFAULT ''`);
  }
  const hasPinned = columns.some((col) => col.name === 'pinned');
  if (!hasPinned) {
    database.exec(`ALTER TABLE knives ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }

  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as Array<{ name: string }>;
  const hasCompareList = tables.some((t) => t.name === 'compare_list');
  if (!hasCompareList) {
    database.exec(`
      CREATE TABLE compare_list (
        knife_id TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      );
    `);
  }
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS knives (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      steel TEXT NOT NULL DEFAULT '',
      blade_style TEXT NOT NULL,
      handle_material TEXT NOT NULL,
      images TEXT NOT NULL,
      specs TEXT NOT NULL,
      description TEXT NOT NULL,
      added_at TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateSchema(database);
}
