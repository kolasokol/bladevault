'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FolderOpen,
  Info,
  Loader2,
  LogOut,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { getApiErrorMessage, readJsonResponse } from '@/lib/api-response'
import {
  APP_THEMES,
  SETTINGS_UPDATED_EVENT,
  type AppSettings,
  type AppTheme,
} from '@/lib/settings-shared'
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
import {
  SettingsSection,
  SettingsRow,
  MonoValue,
} from '@/components/settings-panels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import pkg from '@/package.json'

type StatusTone = 'idle' | 'loading' | 'success' | 'error'
type SettingsTab = 'general' | 'cloud-backup' | 'appearance' | 'about'

const settingsTabTriggerClassName =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors'

const settingsSecondaryButtonClassName =
  'border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] text-foreground hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground dark:border-[#d3c097]/30 dark:bg-[#382f1d] dark:text-[var(--bladevault-gold)] dark:hover:bg-[#4a3f25] dark:hover:text-[var(--bladevault-gold)]'

const settingsPrimaryButtonClassName =
  'border-[var(--bladevault-gold)] bg-[var(--bladevault-gold)] text-[var(--bladevault-olive)] hover:bg-[var(--bladevault-title)] hover:text-[var(--bladevault-olive)]'

const settingsRowClassName =
  'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 border-b border-[var(--bladevault-line)]/60 last:border-b-0'

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

export default function SettingsView() {
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [searchQuery, setSearchQuery] = useState('')

  const authUrl = cloudConfig.authUrl
  const backupUrl = cloudConfig.backupUrl
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

  const tabs = useMemo(
    () => [
      { id: 'general' as const, label: 'General', icon: Database },
      { id: 'cloud-backup' as const, label: 'Cloud Backup', icon: Cloud },
      { id: 'appearance' as const, label: 'Appearance', icon: Palette },
      { id: 'about' as const, label: 'About', icon: Info },
    ],
    [],
  )

  const visibleTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return tabs
    return tabs.filter(
      (tab) =>
        tab.label.toLowerCase().includes(query) ||
        tab.id.toLowerCase().includes(query),
    )
  }, [searchQuery, tabs])

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
  }, [loadAttemptKey, refreshCloudConfig, refreshCloudSession])

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

  const handleThemeChange = async (value: string | null) => {
    const theme = value as AppTheme
    if (!theme || !APP_THEMES.includes(theme)) return

    try {
      await saveSettings({ theme })
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to save settings',
      )
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !settings ? (
        <div className="flex flex-col gap-4 py-6">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError || 'Failed to load settings.'}</span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              className={`${settingsPrimaryButtonClassName} rounded-lg`}
              onClick={() => setLoadAttemptKey((current) => current + 1)}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-[var(--bladevault-line)] bg-sidebar">
          {/* Sidebar */}
          <aside className="flex w-56 flex-col border-r border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/35">
            <div className="border-b border-[var(--bladevault-line)] p-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search settings..."
                  className="h-8 rounded-lg border-[var(--bladevault-line)] bg-card pl-8 text-xs shadow-none"
                />
              </div>
            </div>
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {visibleTabs.map((tab) => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      settingsTabTriggerClassName,
                      isActive
                        ? 'bg-card font-medium text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-[var(--bladevault-surface-hover)] hover:text-foreground',
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{tab.label}</span>
                    {tab.id === 'cloud-backup' ? (
                      <span className="flex h-4 shrink-0 items-center rounded-full border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--bladevault-olive)] dark:border-[var(--bladevault-gold)] dark:bg-[var(--bladevault-gold)] dark:text-[var(--bladevault-olive)]">
                        Beta
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {visibleTabs.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  No settings match “{searchQuery}”.
                </div>
              ) : null}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sidebar">
            <div className="border-b border-[var(--bladevault-line)] bg-sidebar px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-sidebar p-4 sm:p-5">
              {activeTab === 'general' && (
                <div className="mx-auto max-w-3xl space-y-3">
                  <SettingsSection
                    title="Local Vault"
                    description="Where your collection lives on this device."
                  >
                    <SettingsRow
                      label="Current data folder"
                      description="The active vault used by BladeVault right now."
                    >
                      <MonoValue>{localDataPath || 'Unavailable'}</MonoValue>
                    </SettingsRow>

                    <SettingsRow
                      label="Change local data folder"
                      description="Change where images and the database are stored."
                    >
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Input
                          value={pendingLocalDataPath}
                          onChange={(event) => {
                            setPendingLocalDataPath(event.target.value)
                            setLocalDataStatus('idle')
                            setLocalDataMessage('')
                          }}
                          placeholder={
                            defaultLocalDataPath || '/Users/you/BladeVault/data'
                          }
                          disabled={dataDirManagedByEnv}
                          className="h-8 min-w-[10rem] rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] font-mono text-xs shadow-none dark:border-[#d3c097]/30 dark:bg-[#382f1d]"
                        />
                        {canChooseLocalDataFolder ? (
                          <Button
                            type="button"
                            variant="outline"
                            className={`${settingsSecondaryButtonClassName} h-8 rounded-lg`}
                            onClick={handleChooseLocalDataFolder}
                            disabled={dataDirManagedByEnv}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Choose
                          </Button>
                        ) : null}
                      </div>
                    </SettingsRow>

                    <SettingsRow
                      label="Move existing data"
                      description="Copy your current vault into the new folder."
                    >
                      <Checkbox
                        checked={moveExistingLocalData}
                        onCheckedChange={(checked) =>
                          setMoveExistingLocalData(checked === true)
                        }
                        disabled={dataDirManagedByEnv}
                        aria-label="Move existing local data"
                      />
                    </SettingsRow>

                    {configuredLocalDataPath ? (
                      <SettingsRow
                        label="Launch folder"
                        description="Path saved in settings for the next launch."
                      >
                        <MonoValue>{configuredLocalDataPath}</MonoValue>
                      </SettingsRow>
                    ) : null}

                    {dataDirManagedByEnv ? (
                      <SettingsRow
                        label="Data directory source"
                        description="This folder is controlled by BLADEVAULT_DATA_DIR."
                      >
                        <MonoValue>{localDataPath || 'Unavailable'}</MonoValue>
                      </SettingsRow>
                    ) : null}

                    {dockerHostDataMountPath ? (
                      <SettingsRow
                        label="Docker host mount"
                        description="The host path mounted into the container."
                      >
                        <MonoValue>{dockerHostDataMountPath}</MonoValue>
                      </SettingsRow>
                    ) : null}

                    {isContainerized && !dockerHostDataMountPath ? (
                      <SettingsRow
                        label="Docker host mount"
                        description="Host folder is unavailable in this container."
                      />
                    ) : null}

                    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                  </SettingsSection>
                </div>
              )}

              {activeTab === 'cloud-backup' && (
                <div className="mx-auto max-w-3xl space-y-3">
                  <SettingsSection
                    title="Cloud Backup"
                    description="Encrypted backups and cross-device sync."
                  >
                    <SettingsRow
                      label="Session"
                      description={
                        cloudSession
                          ? `Signed in as ${cloudSession.user.email}`
                          : 'Not signed in'
                      }
                    >
                      {cloudSession ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--bladevault-local)] dark:text-[var(--bladevault-gold)]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Connected
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </SettingsRow>

                    <SettingsRow
                      label="Account"
                      description={cloudSession?.user.email || '—'}
                    />

                    <SettingsRow
                      label="Last sync"
                      description={formatSyncTime(
                        settings.cloudBackupLastSyncedAt,
                      )}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={`${settingsSecondaryButtonClassName} h-8 rounded-lg`}
                        onClick={() => refreshCloudSession()}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </Button>
                    </SettingsRow>

                    <SettingsRow
                      label="Auto backup"
                      description="Upload changes automatically after edits."
                    >
                      <Checkbox
                        checked={settings.cloudAutoBackupEnabled}
                        onCheckedChange={(checked) =>
                          handleAutoBackupToggle(checked === true)
                        }
                        disabled={!cloudSession}
                        aria-label="Enable auto backup"
                      />
                    </SettingsRow>
                  </SettingsSection>

                  {cloudSession ? (
                    <SettingsSection title="Sync Actions">
                      <SettingsRow
                        label="Backup now"
                        description="Upload local vault to the cloud."
                      >
                        <Button
                          size="sm"
                          className={`${settingsPrimaryButtonClassName} h-8 rounded-lg`}
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
                      </SettingsRow>

                      <SettingsRow
                        label="Restore from cloud"
                        description="Replace local vault with the latest cloud backup."
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className={`${settingsSecondaryButtonClassName} h-8 rounded-lg`}
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
                      </SettingsRow>

                      {(backupStatus !== 'idle' ||
                        restoreStatus !== 'idle') && (
                        <div className="space-y-2 py-3">
                          <StatusPill
                            status={backupStatus}
                            message={backupMessage}
                          />
                          <StatusPill
                            status={restoreStatus}
                            message={restoreMessage}
                          />
                        </div>
                      )}
                    </SettingsSection>
                  ) : null}

                  <SettingsSection title="Account">
                    {cloudSession ? (
                      <SettingsRow label="Sign out">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`${settingsSecondaryButtonClassName} h-8 rounded-lg`}
                          onClick={handleLogout}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign Out
                        </Button>
                      </SettingsRow>
                    ) : (
                      <>
                        {cloudConfigError ? (
                          <div className="py-3">
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                              {cloudConfigError}
                            </div>
                          </div>
                        ) : null}

                        <SettingsRow label="Sign in">
                          <Button
                            size="sm"
                            className={`${settingsPrimaryButtonClassName} h-8 rounded-lg`}
                            onClick={handleGoogleSignIn}
                            disabled={Boolean(cloudConfigError)}
                          >
                            <FcGoogle className="h-4 w-4" />
                            Continue With Google
                          </Button>
                        </SettingsRow>

                        {authStatus !== 'idle' ? (
                          <div className="py-3">
                            <StatusPill
                              status={authStatus}
                              message={authMessage}
                            />
                          </div>
                        ) : null}
                      </>
                    )}
                  </SettingsSection>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="mx-auto max-w-3xl space-y-3">
                  <SettingsSection title="Theme">
                    <SettingsRow
                      label="Appearance"
                      description="Choose how BladeVault looks on this device."
                    >
                      <Select
                        value={settings.theme}
                        onValueChange={handleThemeChange}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 min-w-[8rem] rounded-lg border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_THEMES.map((theme) => (
                            <SelectItem
                              key={theme}
                              value={theme}
                              className="text-sm capitalize"
                            >
                              {theme}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                  </SettingsSection>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="mx-auto max-w-3xl space-y-3">
                  <SettingsSection title="BladeVault">
                    <SettingsRow label="Version" description={pkg.version} />
                    <SettingsRow
                      label="Repository"
                      description={pkg.repository?.url}
                    >
                      <a
                        href={pkg.repository?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--bladevault-surface-hover)]"
                      >
                        View on GitHub
                      </a>
                    </SettingsRow>
                    <SettingsRow label="License" description="MIT" />
                  </SettingsSection>
                </div>
              )}
            </div>

            {loadError ? (
              <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:mx-5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loadError}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
