import { getLocalDb } from './local-db'
import {
  APP_THEMES,
  CUSTOM_FIELD_TYPES,
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppTheme,
  type CustomField,
  type CustomFieldType,
} from './settings-shared'
export { DEFAULT_SETTINGS, SETTINGS_UPDATED_EVENT } from './settings-shared'
export type {
  AppSettings,
  AppTheme,
  CustomField,
  CustomFieldType,
} from './settings-shared'

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  theme: 'theme',
  pinnedItemsFirst: 'pinned_items_first',
  cloudBackupLastSyncedAt: 'cloud_backup_last_synced_at',
  cloudAutoBackupEnabled: 'cloud_auto_backup_enabled',
  customFields: 'custom_fields',
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

function isCustomFieldType(value: unknown): value is CustomFieldType {
  return (
    typeof value === 'string' &&
    CUSTOM_FIELD_TYPES.includes(value as CustomFieldType)
  )
}

function parseCustomFields(value: string | undefined): CustomField[] {
  if (!value) return DEFAULT_SETTINGS.customFields

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_SETTINGS.customFields

    const fields: CustomField[] = []
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        isCustomFieldType((item as Record<string, unknown>).type)
      ) {
        fields.push({
          id: String((item as Record<string, unknown>).id),
          name: String((item as Record<string, unknown>).name),
          type: (item as Record<string, unknown>).type as CustomFieldType,
        })
      }
    }
    return fields
  } catch {
    return DEFAULT_SETTINGS.customFields
  }
}

export function getSettings(): AppSettings {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>

  const map = new Map(rows.map((row) => [row.key, row.value]))

  return {
    theme: parseTheme(map.get(SETTINGS_KEYS.theme)),
    pinnedItemsFirst:
      map.get(SETTINGS_KEYS.pinnedItemsFirst) === '1'
        ? true
        : DEFAULT_SETTINGS.pinnedItemsFirst,
    cloudBackupLastSyncedAt:
      map.get(SETTINGS_KEYS.cloudBackupLastSyncedAt) ||
      DEFAULT_SETTINGS.cloudBackupLastSyncedAt,
    cloudAutoBackupEnabled:
      map.get(SETTINGS_KEYS.cloudAutoBackupEnabled) === '1'
        ? true
        : DEFAULT_SETTINGS.cloudAutoBackupEnabled,
    customFields: parseCustomFields(map.get(SETTINGS_KEYS.customFields)),
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
    ['pinnedItemsFirst', next.pinnedItemsFirst ? '1' : '0'],
    ['cloudBackupLastSyncedAt', next.cloudBackupLastSyncedAt],
    ['cloudAutoBackupEnabled', next.cloudAutoBackupEnabled ? '1' : '0'],
    ['customFields', JSON.stringify(next.customFields)],
  ]

  const transaction = getDb().transaction(() => {
    for (const [key, value] of entries) {
      insert.run(SETTINGS_KEYS[key], value)
    }
  })

  transaction()
  return next
}
