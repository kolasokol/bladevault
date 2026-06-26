import { getLocalDb } from './local-db';

export type AppSettings = {
  cloudBackupUrl: string;
  cloudBackupLastSyncedAt: string;
};

export const DEFAULT_CLOUD_BACKUP_URL =
  process.env.NEXT_PUBLIC_BLADEVAULT_BACKEND_URL?.trim() || 'https://api-staging.tkweb.site';

export const DEFAULT_SETTINGS: AppSettings = {
  cloudBackupUrl: DEFAULT_CLOUD_BACKUP_URL,
  cloudBackupLastSyncedAt: '',
};

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  cloudBackupUrl: 'cloud_backup_url',
  cloudBackupLastSyncedAt: 'cloud_backup_last_synced_at',
};

function getDb() {
  return getLocalDb();
}

export function getSettings(): AppSettings {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    cloudBackupUrl: map.get(SETTINGS_KEYS.cloudBackupUrl) || DEFAULT_SETTINGS.cloudBackupUrl,
    cloudBackupLastSyncedAt:
      map.get(SETTINGS_KEYS.cloudBackupLastSyncedAt) ||
      DEFAULT_SETTINGS.cloudBackupLastSyncedAt,
  };
}

function normalizeCloudBackupUrl(url: string): string {
  let normalized = url.trim();
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, '');
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...settings };

  if (settings.cloudBackupUrl !== undefined) {
    next.cloudBackupUrl = normalizeCloudBackupUrl(next.cloudBackupUrl);
  }

  const insert = getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  const entries: Array<[keyof AppSettings, string]> = [
    ['cloudBackupUrl', next.cloudBackupUrl],
    ['cloudBackupLastSyncedAt', next.cloudBackupLastSyncedAt],
  ];

  const transaction = getDb().transaction(() => {
    for (const [key, value] of entries) {
      insert.run(SETTINGS_KEYS[key], value);
    }
  });

  transaction();
  return next;
}
