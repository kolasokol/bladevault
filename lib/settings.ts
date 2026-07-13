import { getLocalDb } from './local-db'
import {
  APP_THEMES,
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppTheme,
} from './settings-shared'
export { DEFAULT_SETTINGS, SETTINGS_UPDATED_EVENT } from './settings-shared'
export type { AppSettings, AppTheme } from './settings-shared'

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  theme: 'theme',
  cloudBackupLastSyncedAt: 'cloud_backup_last_synced_at',
  cloudAutoBackupEnabled: 'cloud_auto_backup_enabled',
}

function getDb() {
  return getLocalDb()
}

function parseTheme(value: string | undefined): AppTheme {
  if (value && APP_THEMES.includes(value as AppTheme)) {
    return value as AppTheme
  }

  return DEFAULT_SETTINGS.theme
}

export function getSettings(): AppSettings {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>

  const map = new Map(rows.map((row) => [row.key, row.value]))

  return {
    theme: parseTheme(map.get(SETTINGS_KEYS.theme)),
    cloudBackupLastSyncedAt:
      map.get(SETTINGS_KEYS.cloudBackupLastSyncedAt) ||
      DEFAULT_SETTINGS.cloudBackupLastSyncedAt,
    cloudAutoBackupEnabled:
      map.get(SETTINGS_KEYS.cloudAutoBackupEnabled) === '1'
        ? true
        : DEFAULT_SETTINGS.cloudAutoBackupEnabled,
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next = { ...current, ...settings }

  const insert = getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
  )

  const entries: Array<[keyof AppSettings, string]> = [
    ['theme', next.theme],
    ['cloudBackupLastSyncedAt', next.cloudBackupLastSyncedAt],
    ['cloudAutoBackupEnabled', next.cloudAutoBackupEnabled ? '1' : '0'],
  ]

  const transaction = getDb().transaction(() => {
    for (const [key, value] of entries) {
      insert.run(SETTINGS_KEYS[key], value)
    }
  })

  transaction()
  return next
}
