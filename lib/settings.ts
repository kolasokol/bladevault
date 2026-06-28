import { getLocalDb } from './local-db';
import { DEFAULT_SETTINGS, type AppSettings } from './settings-shared';
export { DEFAULT_SETTINGS, SETTINGS_UPDATED_EVENT } from './settings-shared';
export type { AppSettings } from './settings-shared';

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  cloudBackupLastSyncedAt: 'cloud_backup_last_synced_at',
  cloudAutoBackupEnabled: 'cloud_auto_backup_enabled',
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
    cloudBackupLastSyncedAt:
      map.get(SETTINGS_KEYS.cloudBackupLastSyncedAt) ||
      DEFAULT_SETTINGS.cloudBackupLastSyncedAt,
    cloudAutoBackupEnabled:
      map.get(SETTINGS_KEYS.cloudAutoBackupEnabled) === '1'
        ? true
        : DEFAULT_SETTINGS.cloudAutoBackupEnabled,
  };
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...settings };

  const insert = getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  const entries: Array<[keyof AppSettings, string]> = [
    ['cloudBackupLastSyncedAt', next.cloudBackupLastSyncedAt],
    ['cloudAutoBackupEnabled', next.cloudAutoBackupEnabled ? '1' : '0'],
  ];

  const transaction = getDb().transaction(() => {
    for (const [key, value] of entries) {
      insert.run(SETTINGS_KEYS[key], value);
    }
  });

  transaction();
  return next;
}
