export const APP_THEMES = ['light', 'dark'] as const

export type AppTheme = (typeof APP_THEMES)[number]

export type AppSettings = {
  theme: AppTheme
  cloudBackupLastSyncedAt: string
  cloudAutoBackupEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  cloudBackupLastSyncedAt: '',
  cloudAutoBackupEnabled: false,
}

export const SETTINGS_UPDATED_EVENT = 'bladevault-settings-change'
