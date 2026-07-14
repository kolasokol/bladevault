'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FolderOpen,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { getApiErrorMessage, readJsonResponse } from '@/lib/api-response'
import { SETTINGS_UPDATED_EVENT, type AppSettings } from '@/lib/settings-shared'
import {
  clearCloudAuthState,
  CloudAuthErrorMessage,
  CloudAuthState,
  CloudAuthSuccessMessage,
  CloudRuntimeConfig,
  CloudBackupSession,
  createCloudAuthHeaders,
  getCloudAuthState,
  getCloudRuntimeConfig,
  loadCloudRuntimeConfig,
  parseApiError,
  refreshCloudBackupAccessToken,
  setCloudAuthState,
} from '@/lib/cloud-backup'
import {
  formatCloudBackupError,
  uploadCloudBackupArchive,
} from '@/lib/cloud-backup-client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type StatusTone = 'idle' | 'loading' | 'success' | 'error'

const settingsTabTriggerClassName =
  'h-8 flex-none justify-center rounded-[10px] border border-transparent px-3 text-xs font-medium text-muted-foreground shadow-none hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground data-active:border-transparent data-active:bg-card data-active:text-[var(--bladevault-olive)] data-active:shadow-sm dark:text-[#c2b58e] dark:hover:text-[var(--bladevault-gold)] dark:data-active:text-[var(--bladevault-gold)]'

const settingsSecondaryButtonClassName =
  'border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] text-foreground hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground dark:border-[#d3c097]/30 dark:bg-[#382f1d] dark:text-[var(--bladevault-gold)] dark:hover:bg-[#4a3f25] dark:hover:text-[var(--bladevault-gold)]'

const settingsPrimaryButtonClassName =
  'border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)] hover:bg-[var(--bladevault-title)] hover:text-[var(--bladevault-olive)]'

const settingsPanelClassName =
  'overflow-hidden rounded-xl border border-[var(--bladevault-line)] bg-card shadow-none'

const settingsPanelHeaderClassName =
  'border-b border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-4 py-3 dark:border-[#d3c097]/30 dark:bg-[#382f1d]'

const settingsNoteClassName =
  'rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-3 py-3 text-xs text-muted-foreground dark:border-[#d3c097]/30 dark:bg-[#382f1d]'

function StatusPill({
  status,
  message,
}: {
  status: StatusTone
  message?: string
}) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="min-w-0 break-words">{message || 'Working...'}</span>
      </span>
    )
  }

  if (status === 'success') {
    return (
      <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-[var(--bladevault-local)] dark:text-[var(--bladevault-gold)]">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="min-w-0 break-words">{message || 'Done'}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" />
      <span className="min-w-0 break-words">
        {message || 'Something went wrong'}
      </span>
    </span>
  )
}

function formatSyncTime(value: string) {
  if (!value) return 'Never'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function applyThemePreference(theme: AppSettings['theme']) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [localDataPath, setLocalDataPath] = useState('')
  const [configuredLocalDataPath, setConfiguredLocalDataPath] = useState('')
  const [defaultLocalDataPath, setDefaultLocalDataPath] = useState('')
  const [pendingLocalDataPath, setPendingLocalDataPath] = useState('')
  const [moveExistingLocalData, setMoveExistingLocalData] = useState(true)
  const [dataDirManagedByEnv, setDataDirManagedByEnv] = useState(false)
  const [dockerHostDataMountPath, setDockerHostDataMountPath] = useState('')
  const [isContainerized, setIsContainerized] = useState(false)
  const [cloudSession, setCloudSession] = useState<CloudBackupSession | null>(
    null,
  )
  const [cloudConfig, setCloudConfig] = useState<CloudRuntimeConfig>(() =>
    getCloudRuntimeConfig(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [authStatus, setAuthStatus] = useState<StatusTone>('idle')
  const [authMessage, setAuthMessage] = useState('')
  const [sessionStatus, setSessionStatus] = useState<StatusTone>('idle')
  const [sessionMessage, setSessionMessage] = useState('')
  const [backupStatus, setBackupStatus] = useState<StatusTone>('idle')
  const [backupMessage, setBackupMessage] = useState('')
  const [restoreStatus, setRestoreStatus] = useState<StatusTone>('idle')
  const [restoreMessage, setRestoreMessage] = useState('')
  const [localDataStatus, setLocalDataStatus] = useState<StatusTone>('idle')
  const [localDataMessage, setLocalDataMessage] = useState('')
  const [loadAttemptKey, setLoadAttemptKey] = useState(0)

  const authUrl = cloudConfig.authUrl
  const backupUrl = cloudConfig.backupUrl
  const authOrigin = authUrl ? new URL(authUrl).origin : ''
  const cloudConfigError = [
    !authUrl ? 'NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.' : null,
    !backupUrl ? 'NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.' : null,
  ]
    .filter(Boolean)
    .join(' ')
  const canChooseLocalDataFolder =
    typeof window !== 'undefined' &&
    Boolean(window.bladevaultDesktop?.selectDirectory)
  const normalizedPendingLocalDataPath = pendingLocalDataPath.trim()
  const isLocalDataFolderDirty =
    normalizedPendingLocalDataPath !== '' &&
    normalizedPendingLocalDataPath !== localDataPath

  const refreshCloudConfig = useCallback(async (force = false) => {
    const nextConfig = await loadCloudRuntimeConfig(force)
    setCloudConfig(nextConfig)
    return nextConfig
  }, [])

  const refreshCloudSession = useCallback(
    async (cancelled = false) => {
      const state = getCloudAuthState()
      if (!state?.sessionToken) {
        if (!cancelled) {
          setCloudSession(null)
          setSessionStatus('idle')
          setSessionMessage('')
        }
        return
      }

      setSessionStatus('loading')
      setSessionMessage('Checking cloud session...')

      try {
        const nextConfig = await refreshCloudConfig()
        if (!nextConfig.authUrl) {
          throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.')
        }

        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 8000)

        const response = await fetch(`${nextConfig.authUrl}/api/me`, {
          headers: createCloudAuthHeaders(),
          signal: controller.signal,
        })
        window.clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const data = await readJsonResponse<CloudBackupSession | null>(response)
        if (cancelled) return

        if (data?.user && data?.session) {
          const existingState = getCloudAuthState()
          if (existingState) {
            setCloudAuthState({
              ...existingState,
              sessionToken: data.session.token,
              expiresAt: data.session.expiresAt,
              user: data.user,
            })
          }
          setCloudSession(data)
          setSessionStatus('success')
          setSessionMessage(`Signed in as ${data.user.email}`)
        } else {
          setCloudSession(null)
          setSessionStatus('idle')
          setSessionMessage('')
        }
      } catch (error) {
        if (!cancelled) {
          setCloudSession(null)
          setSessionStatus('error')
          setSessionMessage(
            formatCloudBackupError(error, getCloudRuntimeConfig().authUrl),
          )
        }
      }
    },
    [refreshCloudConfig],
  )

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setLoadError(null)
      setLocalDataStatus('idle')
      setLocalDataMessage('')

      try {
        const [response, nextCloudConfig] = await Promise.all([
          fetch('/api/settings', { cache: 'no-store' }),
          refreshCloudConfig(true),
        ])
        const data = await readJsonResponse<{
          configuredLocalDataPath?: string | null
          dataDirManagedByEnv?: boolean
          defaultLocalDataPath?: string
          error?: string
          settings?: AppSettings
          localDataPath?: string
          dockerHostDataMountPath?: string | null
          isContainerized?: boolean
        }>(response)
        if (!response.ok) {
          throw new Error(getApiErrorMessage(data, 'Failed to load settings'))
        }

        const nextSettings = data.settings
        if (!nextSettings) {
          throw new Error('BladeVault did not return settings data.')
        }

        if (cancelled) return
        setSettings(nextSettings)
        setLocalDataPath(data.localDataPath || '')
        setConfiguredLocalDataPath(data.configuredLocalDataPath || '')
        setDefaultLocalDataPath(data.defaultLocalDataPath || '')
        setPendingLocalDataPath(data.localDataPath || '')
        setDataDirManagedByEnv(Boolean(data.dataDirManagedByEnv))
        setDockerHostDataMountPath(data.dockerHostDataMountPath || '')
        setIsContainerized(Boolean(data.isContainerized))
        setCloudConfig(nextCloudConfig)
        void refreshCloudSession(cancelled)
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Failed to load settings',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, loadAttemptKey, refreshCloudConfig, refreshCloudSession])

  const saveSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    const data = await readJsonResponse<{
      error?: string
      settings?: AppSettings
    }>(response)
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Failed to save settings'))
    }

    const nextSettings = data.settings
    if (!nextSettings) {
      throw new Error('BladeVault did not return settings data.')
    }
    setSettings(nextSettings)
    applyThemePreference(nextSettings.theme)

    window.dispatchEvent(
      new CustomEvent<Partial<AppSettings>>(SETTINGS_UPDATED_EVENT, {
        detail: nextSettings,
      }),
    )

    return nextSettings
  }, [])

  const handleChooseLocalDataFolder = async () => {
    const nextPath = await window.bladevaultDesktop?.selectDirectory()
    if (!nextPath) {
      return
    }

    setPendingLocalDataPath(nextPath)
    setLocalDataStatus('idle')
    setLocalDataMessage('')
  }

  const handleSaveLocalDataFolder = async () => {
    setLocalDataStatus('loading')
    setLocalDataMessage(
      moveExistingLocalData
        ? 'Moving your local vault to the new folder...'
        : 'Updating your local data folder...',
    )

    try {
      const response = await fetch('/api/settings/local-data-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveExistingData: moveExistingLocalData,
          path: normalizedPendingLocalDataPath,
        }),
      })

      const data = await readJsonResponse<{
        configuredLocalDataPath?: string | null
        defaultLocalDataPath?: string
        dockerHostDataMountPath?: string | null
        error?: string
        isContainerized?: boolean
        localDataPath?: string
        message?: string
        settings?: AppSettings
        warning?: string
      }>(response)
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(data, 'Failed to update local data folder'),
        )
      }

      const nextSettings = data.settings
      if (!nextSettings) {
        throw new Error('BladeVault did not return settings data.')
      }

      setSettings(nextSettings)
      setLocalDataPath(data.localDataPath || normalizedPendingLocalDataPath)
      setConfiguredLocalDataPath(data.configuredLocalDataPath || '')
      setDefaultLocalDataPath(data.defaultLocalDataPath || '')
      setPendingLocalDataPath(
        data.localDataPath || normalizedPendingLocalDataPath,
      )
      setDockerHostDataMountPath(data.dockerHostDataMountPath || '')
      setIsContainerized(Boolean(data.isContainerized))
      applyThemePreference(nextSettings.theme)
      window.dispatchEvent(
        new CustomEvent<Partial<AppSettings>>(SETTINGS_UPDATED_EVENT, {
          detail: nextSettings,
        }),
      )

      setLocalDataStatus('success')
      setLocalDataMessage(
        data.warning ||
          `${data.message || 'Local data folder updated.'} Reloading your vault...`,
      )
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      setLocalDataStatus('error')
      setLocalDataMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update local data folder',
      )
    }
  }

  const handleGoogleSignIn = async () => {
    if (!settings) return

    setAuthStatus('loading')
    setAuthMessage('Opening Google sign-in...')

    try {
      const nextConfig = await refreshCloudConfig()
      const nextAuthOrigin = nextConfig.authUrl
        ? new URL(nextConfig.authUrl).origin
        : ''
      if (!nextConfig.authUrl || !nextAuthOrigin) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.')
      }

      const clientOrigin =
        typeof window !== 'undefined' ? window.location.origin : '/'
      const startUrl = new URL('/auth/popup/start', nextConfig.authUrl)
      startUrl.searchParams.set('client_origin', clientOrigin)

      const popup = window.open(
        startUrl.toString(),
        'bladevault-google-auth',
        'width=500,height=640,menubar=no,toolbar=no',
      )

      if (!popup) {
        throw new Error('Popup was blocked. Allow popups and try again.')
      }

      const result = await new Promise<CloudAuthSuccessMessage>(
        (resolve, reject) => {
          let settled = false

          const cleanup = () => {
            if (settled) return
            settled = true
            window.removeEventListener('message', onMessage)
            window.clearInterval(closedPoll)
            window.clearTimeout(timeout)
          }

          const onMessage = (event: MessageEvent) => {
            if (event.origin !== nextAuthOrigin) return
            const data = event.data as
              CloudAuthSuccessMessage | CloudAuthErrorMessage
            if (!data || typeof data !== 'object' || !('type' in data)) return

            if (data.type === 'bladevault-auth-error') {
              cleanup()
              reject(new Error(data.error.message || 'Google sign-in failed.'))
              return
            }
            if (data.type !== 'bladevault-auth-success') return

            cleanup()
            resolve(data)
          }

          const closedPoll = window.setInterval(() => {
            if (popup.closed) {
              cleanup()
              reject(new Error('Google sign-in was closed before completion.'))
            }
          }, 500)

          const timeout = window.setTimeout(
            () => {
              cleanup()
              try {
                popup.close()
              } catch {
                // ignore
              }
              reject(new Error('Google sign-in timed out. Please try again.'))
            },
            5 * 60 * 1000,
          )

          window.addEventListener('message', onMessage)
        },
      )

      const nextAuthState: CloudAuthState = {
        accessToken: result.accessToken,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      }
      setCloudAuthState(nextAuthState)
      await refreshCloudSession()
      setAuthStatus('success')
      setAuthMessage('Signed in. Cloud backup is ready.')
    } catch (error) {
      setAuthStatus('error')
      setAuthMessage(
        formatCloudBackupError(error, getCloudRuntimeConfig().authUrl),
      )
    }
  }

  const handleLogout = async () => {
    if (!settings) return

    setSessionStatus('loading')
    setSessionMessage('Signing out...')

    try {
      const nextConfig = await refreshCloudConfig()
      if (!nextConfig.authUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.')
      }

      const response = await fetch(`${nextConfig.authUrl}/api/auth/sign-out`, {
        method: 'POST',
        headers: createCloudAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      setCloudSession(null)
      clearCloudAuthState()
      setSessionStatus('success')
      setSessionMessage('Signed out')
    } catch (error) {
      setSessionStatus('error')
      setSessionMessage(
        formatCloudBackupError(error, getCloudRuntimeConfig().authUrl),
      )
    }
  }

  const handleBackup = async () => {
    if (!settings) return

    setBackupStatus('loading')
    setBackupMessage('Uploading your local data folder...')

    try {
      const { syncedAt } = await uploadCloudBackupArchive()
      setSettings((prev) =>
        prev ? { ...prev, cloudBackupLastSyncedAt: syncedAt } : prev,
      )
      setBackupStatus('success')
      setBackupMessage('Cloud backup is up to date.')
    } catch (error) {
      setBackupStatus('error')
      setBackupMessage(
        formatCloudBackupError(error, getCloudRuntimeConfig().backupUrl),
      )
    }
  }

  const handleRestore = async () => {
    if (!settings) return
    if (
      !window.confirm(
        'Restore from cloud and replace your current local vault on this device?',
      )
    ) {
      return
    }

    setRestoreStatus('loading')
    setRestoreMessage('Downloading your cloud backup...')

    try {
      const nextConfig = await refreshCloudConfig()
      if (!nextConfig.backupUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.')
      }

      const accessToken = await refreshCloudBackupAccessToken()

      const importResponse = await fetch('/api/cloud-backup/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupUrl: nextConfig.backupUrl,
          accessToken,
        }),
      })

      const importData = await readJsonResponse<{ error?: string }>(
        importResponse,
      )
      if (!importResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            importData,
            'Failed to restore cloud backup locally',
          ),
        )
      }

      setRestoreStatus('success')
      setRestoreMessage(
        'Cloud backup restored locally. Reloading your vault...',
      )
      window.setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      setRestoreStatus('error')
      setRestoreMessage(
        formatCloudBackupError(error, getCloudRuntimeConfig().backupUrl),
      )
    }
  }

  const handleAutoBackupToggle = async (checked: boolean) => {
    if (!settings) return

    try {
      await saveSettings({ cloudAutoBackupEnabled: checked })
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to save settings',
      )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[42.5rem] overflow-hidden rounded-2xl border border-[var(--bladevault-line)] bg-card p-0 shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-[42.5rem]">
        {isLoading ? (
          <>
            <DialogHeader className="border-b border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 px-5 py-4">
              <DialogTitle className="text-sm">Settings</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : !settings ? (
          <>
            <DialogHeader className="border-b border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 px-5 py-4">
              <DialogTitle className="text-sm">Settings</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 py-6">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loadError || 'Failed to load settings.'}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={onClose}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className={`${settingsPrimaryButtonClassName} rounded-lg`}
                  onClick={() => setLoadAttemptKey((current) => current + 1)}
                >
                  Retry
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Tabs
            defaultValue="general"
            className="flex max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col gap-0 overflow-hidden"
          >
            <div className="shrink-0 border-b border-[var(--bladevault-line)] px-4 pt-4 pb-3 sm:px-[18px]">
              <DialogHeader>
                <DialogTitle className="text-sm">Settings</DialogTitle>
              </DialogHeader>
              <TabsList className="mt-3 h-auto w-fit max-w-full gap-[3px] overflow-hidden rounded-[14px] border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] p-[3px]">
                <TabsTrigger
                  value="general"
                  className={settingsTabTriggerClassName}
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="cloud-backup"
                  className={settingsTabTriggerClassName}
                >
                  <span className="flex items-center gap-2">
                    <span>Cloud Backup</span>
                    <span className="flex h-4 shrink-0 items-center rounded-full border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--bladevault-olive)] dark:border-[var(--bladevault-gold)] dark:bg-[var(--bladevault-gold)] dark:text-[var(--bladevault-olive)]">
                      Beta
                    </span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-[18px]">
                <TabsContent value="general" className="mt-0 w-full space-y-4">
                  <div className={settingsPanelClassName}>
                    <div className={settingsPanelHeaderClassName}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]">
                          <Database className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          Local Vault
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Current Local Data Folder
                        </div>
                        <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-2">
                          <div className="break-all font-mono text-xs text-foreground">
                            {localDataPath || 'Unavailable'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Change Local data folder
                        </div>
                        <div className="flex flex-col gap-2 lg:flex-row">
                          <Input
                            value={pendingLocalDataPath}
                            onChange={(event) => {
                              setPendingLocalDataPath(event.target.value)
                              setLocalDataStatus('idle')
                              setLocalDataMessage('')
                            }}
                            placeholder={
                              defaultLocalDataPath ||
                              '/Users/you/BladeVault/data'
                            }
                            disabled={dataDirManagedByEnv}
                            className="h-9 rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] font-mono text-xs shadow-none dark:border-[#d3c097]/30 dark:bg-[#382f1d]"
                          />
                          {canChooseLocalDataFolder ? (
                            <Button
                              type="button"
                              variant="outline"
                              className={`${settingsSecondaryButtonClassName} h-9 rounded-lg`}
                              onClick={handleChooseLocalDataFolder}
                              disabled={dataDirManagedByEnv}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              Choose Folder
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <label className="flex items-start gap-3 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-3">
                        <Checkbox
                          checked={moveExistingLocalData}
                          onCheckedChange={(checked) =>
                            setMoveExistingLocalData(checked === true)
                          }
                          disabled={dataDirManagedByEnv}
                          aria-label="Move existing local data"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-foreground">
                            Move existing data to the new folder
                          </span>
                        </span>
                      </label>

                      {configuredLocalDataPath ? (
                        <div className={settingsNoteClassName}>
                          <div className="text-xs font-medium text-foreground">
                            Launch folder
                          </div>
                          <div className="mt-1 break-all font-mono text-xs text-foreground">
                            {configuredLocalDataPath}
                          </div>
                        </div>
                      ) : null}

                      {dataDirManagedByEnv ? (
                        <div className={settingsNoteClassName}>
                          <strong className="text-foreground">
                            BLADEVAULT_DATA_DIR
                          </strong>{' '}
                          controls this folder.
                        </div>
                      ) : null}

                      {dockerHostDataMountPath ? (
                        <div className={settingsNoteClassName}>
                          Docker Host Mount
                          <div className="mt-2 break-all font-mono text-xs text-foreground">
                            {dockerHostDataMountPath}
                          </div>
                        </div>
                      ) : null}

                      {isContainerized && !dockerHostDataMountPath ? (
                        <div className={settingsNoteClassName}>
                          Host folder unavailable.
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3 border-t border-[var(--bladevault-line)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <StatusPill
                          status={localDataStatus}
                          message={localDataMessage}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className={`${settingsPrimaryButtonClassName} rounded-lg sm:self-auto`}
                          onClick={handleSaveLocalDataFolder}
                          disabled={
                            dataDirManagedByEnv ||
                            !normalizedPendingLocalDataPath ||
                            !isLocalDataFolderDirty
                          }
                        >
                          {localDataStatus === 'loading' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Save Folder
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="cloud-backup"
                  className="mt-0 w-full space-y-4"
                >
                  <div className="space-y-4">
                    <div className="min-w-0 space-y-4">
                      <div className={settingsPanelClassName}>
                        <div className={settingsPanelHeaderClassName}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]">
                              <Cloud className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                Cloud Backup Service
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4 p-4">
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-3 text-xs text-muted-foreground">
                              <div className="font-medium">Session</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {cloudSession ? 'Connected' : 'Not signed in'}
                              </div>
                            </div>
                            <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-3 text-xs text-muted-foreground">
                              <div className="font-medium">Email</div>
                              <div className="mt-2 break-all text-sm font-medium text-foreground">
                                {cloudSession?.user.email || '—'}
                              </div>
                            </div>
                            <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-3 text-xs text-muted-foreground">
                              <div className="font-medium">Last Sync</div>
                              <div className="mt-2 text-sm font-medium text-foreground">
                                {formatSyncTime(
                                  settings.cloudBackupLastSyncedAt,
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <StatusPill
                              status={sessionStatus}
                              message={sessionMessage}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className={`${settingsSecondaryButtonClassName} rounded-lg sm:self-auto`}
                              onClick={() => refreshCloudSession()}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Refresh Session
                            </Button>
                          </div>

                          <label className="flex items-start gap-3 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-3 py-3">
                            <Checkbox
                              checked={settings.cloudAutoBackupEnabled}
                              onCheckedChange={(checked) =>
                                handleAutoBackupToggle(checked === true)
                              }
                              disabled={!cloudSession}
                              aria-label="Enable auto backup"
                            />
                            <span>
                              <span className="block text-sm font-medium text-foreground">
                                Enable auto backup
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {cloudSession ? (
                        <div className={settingsPanelClassName}>
                          <div className={settingsPanelHeaderClassName}>
                            <div className="text-sm font-medium text-foreground">
                              Sync Actions
                            </div>
                          </div>
                          <div className="space-y-4 p-4">
                            <div className="grid gap-2 lg:grid-cols-2">
                              <Button
                                size="sm"
                                className={`${settingsPrimaryButtonClassName} h-10 rounded-lg text-sm`}
                                onClick={handleBackup}
                                disabled={backupStatus === 'loading'}
                              >
                                {backupStatus === 'loading' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                Backup Local → Cloud
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`${settingsSecondaryButtonClassName} h-10 rounded-lg text-sm`}
                                onClick={handleRestore}
                                disabled={restoreStatus === 'loading'}
                              >
                                {restoreStatus === 'loading' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                Restore Cloud → Local
                              </Button>
                            </div>

                            {backupStatus !== 'idle' ||
                            restoreStatus !== 'idle' ? (
                              <div className="space-y-2 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 px-3 py-3">
                                <StatusPill
                                  status={backupStatus}
                                  message={backupMessage}
                                />
                                <StatusPill
                                  status={restoreStatus}
                                  message={restoreMessage}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      {cloudSession ? (
                        <div className={settingsPanelClassName}>
                          <div className={settingsPanelHeaderClassName}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]">
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                  Account
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 p-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className={`${settingsSecondaryButtonClassName} h-9 w-full rounded-lg`}
                              onClick={handleLogout}
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              Sign Out
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className={settingsPanelClassName}>
                          <div className={settingsPanelHeaderClassName}>
                            <div className="text-sm font-medium text-foreground">
                              Sign In To Cloud Backup
                            </div>
                          </div>
                          <div className="space-y-3 p-4">
                            {cloudConfigError ? (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                                {cloudConfigError}
                              </div>
                            ) : null}

                            <Button
                              size="sm"
                              className={`${settingsPrimaryButtonClassName} h-10 w-full rounded-lg text-sm`}
                              onClick={handleGoogleSignIn}
                              disabled={Boolean(cloudConfigError)}
                            >
                              <FcGoogle className="h-4 w-4" />
                              Continue With Google
                            </Button>

                            {authStatus !== 'idle' ? (
                              <div className="space-y-2 rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35 px-3 py-3">
                                <StatusPill
                                  status={authStatus}
                                  message={authMessage}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>

              {loadError ? (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:mx-5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
              ) : null}

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bladevault-line)] px-4 pt-3.5 pb-[18px] sm:px-[18px]">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
