import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { normalizeKnifeTextFields } from '@/lib/knife-text';

export const DATA_DIR = process.env.BLADEVAULT_DATA_DIR?.trim() || 'data';
export const DB_PATH = path.join(DATA_DIR, 'bladevault.sqlite');

let db: Database.Database | null = null;
let restoreInProgress = false;

export function beginLocalRestore(): void {
  restoreInProgress = true;
}

export function endLocalRestore(): void {
  restoreInProgress = false;
}

export function getLocalDataDirPath(): string {
  return path.resolve(DATA_DIR);
}

export function getLocalDb(): Database.Database {
  if (restoreInProgress) {
    throw new Error('Local database restore is in progress. Please try again in a moment.');
  }

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

  normalizeKnifeRows(database);
}

function normalizeKnifeRows(database: Database.Database) {
  const rows = database.prepare(`
    SELECT id, name, brand, blade_style, handle_material, specs, description, source_url
    FROM knives
  `).all() as Array<{
    id: string;
    name: string;
    brand: string;
    blade_style: string;
    handle_material: string;
    specs: string;
    description: string;
    source_url: string;
  }>;

  if (rows.length === 0) {
    return;
  }

  const updateKnife = database.prepare(`
    UPDATE knives
    SET name = ?, brand = ?, blade_style = ?, handle_material = ?, specs = ?, description = ?, source_url = ?
    WHERE id = ?
  `);

  const normalizeRows = database.transaction((items: typeof rows) => {
    for (const row of items) {
      const specs = JSON.parse(row.specs) as Partial<{
        weight: string;
        overallLength: string;
        bladeLength: string;
        bladeThickness?: string;
        bladeCoating?: string;
        bladeMaterial?: string;
        lockingMechanism?: string;
        designer?: string;
        modelNumber?: string;
        handleLength?: string;
        hardness?: string;
        country: string;
      }>;
      const normalized = normalizeKnifeTextFields({
        name: row.name,
        brand: row.brand,
        bladeStyle: row.blade_style,
        handleMaterial: row.handle_material,
        description: row.description,
        sourceUrl: row.source_url,
        specs,
      });

      const normalizedSpecs = JSON.stringify(normalized.specs ?? {});
      const hasChanges =
        normalized.name !== row.name ||
        normalized.brand !== row.brand ||
        normalized.bladeStyle !== row.blade_style ||
        normalized.handleMaterial !== row.handle_material ||
        normalized.description !== row.description ||
        normalized.sourceUrl !== row.source_url ||
        normalizedSpecs !== row.specs;

      if (!hasChanges) {
        continue;
      }

      updateKnife.run(
        normalized.name,
        normalized.brand,
        normalized.bladeStyle,
        normalized.handleMaterial,
        normalizedSpecs,
        normalized.description,
        normalized.sourceUrl,
        row.id
      );
    }
  });

  normalizeRows(rows);
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
