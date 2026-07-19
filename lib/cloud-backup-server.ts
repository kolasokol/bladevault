import { DEFAULT_CLOUD_BACKUP_URL, normalizeCloudUrl } from '@/lib/cloud-backup'

function readBackupUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BLADEVAULT_BACKUP_URL?.trim()
  const normalized = fromEnv
    ? normalizeCloudUrl(fromEnv)
    : DEFAULT_CLOUD_BACKUP_URL
  return normalized || DEFAULT_CLOUD_BACKUP_URL
}

export function getConfiguredCloudBackupUrl(): string {
  return readBackupUrl()
}

export function isBackupUrlAllowed(targetUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return false
  }

  const allowed = new URL(getConfiguredCloudBackupUrl())
  return (
    parsed.protocol === allowed.protocol &&
    parsed.hostname.toLowerCase() === allowed.hostname.toLowerCase() &&
    parsed.port === allowed.port
  )
}
