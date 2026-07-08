'use client'

import {
  getCloudAuthState,
  getCloudRuntimeConfig,
  loadCloudRuntimeConfig,
  parseApiError,
  refreshCloudBackupAccessToken,
} from '@/lib/cloud-backup'
import { getApiErrorMessage, readJsonResponse } from '@/lib/api-response'

export type CloudBackupUploadResult = {
  syncedAt: string
}

export function canAttemptSilentCloudBackup() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }

  const authState = getCloudAuthState()
  if (!authState?.sessionToken) {
    return false
  }

  const config = getCloudRuntimeConfig()
  return Boolean(config.authUrl && config.backupUrl)
}

export function formatCloudBackupError(error: unknown, baseUrl: string) {
  const message = error instanceof Error ? error.message : 'Unknown error'

  if (message === 'Load failed' || message.includes('Failed to fetch')) {
    return `Could not reach Cloud Backup API at ${baseUrl}. Restart the frontend if you just updated it, and confirm the Backup API shown in settings is correct.`
  }

  return message
}

async function updateBackupSyncTime(value: string) {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cloudBackupLastSyncedAt: value }),
  })

  const data = await readJsonResponse<{ error?: string }>(response)
  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(data, 'Failed to update backup timestamp'),
    )
  }
}

export async function uploadCloudBackupArchive(): Promise<CloudBackupUploadResult> {
  const nextConfig = await loadCloudRuntimeConfig()
  if (!nextConfig.backupUrl) {
    throw new Error('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.')
  }

  const accessToken = await refreshCloudBackupAccessToken()

  const archiveResponse = await fetch('/api/cloud-backup/archive', {
    cache: 'no-store',
  })
  if (!archiveResponse.ok) {
    throw new Error(await parseApiError(archiveResponse))
  }

  const archiveBlob = await archiveResponse.blob()
  const response = await fetch(`${nextConfig.backupUrl}/backup/latest`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/gzip',
      'X-Backup-Filename': 'bladevault-data.tar.gz',
    },
    body: archiveBlob,
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(details || `Backup upload failed (${response.status})`)
  }

  const syncedAt = new Date().toISOString()
  await updateBackupSyncTime(syncedAt)

  return { syncedAt }
}
