export {}

declare global {
  type BladeVaultUpdateStatus = {
    status:
      | 'idle'
      | 'checking'
      | 'available'
      | 'downloading'
      | 'downloaded'
      | 'not-available'
      | 'error'
    platform?: NodeJS.Platform
    version?: string
    currentVersion?: string
    percent?: number | null
    path?: string
    sha256?: string
    releaseUrl?: string
    downloadUrl?: string
    message?: string
  }

  interface Window {
    bladevaultDesktop?: {
      selectDirectory: () => Promise<string | null>
      getUpdateStatus: () => Promise<BladeVaultUpdateStatus>
      checkForUpdates: () => Promise<BladeVaultUpdateStatus>
      downloadUpdate: () => Promise<BladeVaultUpdateStatus>
      onUpdateStatus: (
        callback: (status: BladeVaultUpdateStatus) => void,
      ) => () => void
    }
  }
}
