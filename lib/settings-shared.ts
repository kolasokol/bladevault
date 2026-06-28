export type AppSettings = {
  cloudBackupLastSyncedAt: string;
  cloudAutoBackupEnabled: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  cloudBackupLastSyncedAt: '',
  cloudAutoBackupEnabled: false,
};

export const SETTINGS_UPDATED_EVENT = 'bladevault-settings-change';
