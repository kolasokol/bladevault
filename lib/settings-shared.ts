export const APP_THEMES = ['light', 'dark'] as const

export type AppTheme = (typeof APP_THEMES)[number]

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date'] as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export type CustomField = {
  id: string
  name: string
  type: CustomFieldType
}

export type AppSettings = {
  theme: AppTheme
  cloudBackupLastSyncedAt: string
  cloudAutoBackupEnabled: boolean
  customFields: CustomField[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  cloudBackupLastSyncedAt: '',
  cloudAutoBackupEnabled: false,
  customFields: [],
}

export const SETTINGS_UPDATED_EVENT = 'bladevault-settings-change'
