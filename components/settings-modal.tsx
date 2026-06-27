'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { AppSettings } from '@/lib/settings';
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
} from '@/lib/cloud-backup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type StatusTone = 'idle' | 'loading' | 'success' | 'error';

function StatusPill({ status, message }: { status: StatusTone; message?: string }) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="min-w-0 break-words">{message || 'Working...'}</span>
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="min-w-0 break-words">{message || 'Done'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" />
      <span className="min-w-0 break-words">{message || 'Something went wrong'}</span>
    </span>
  );
}

function formatSyncTime(value: string) {
  if (!value) return 'Never';

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCloudBackupError(error: unknown, baseUrl: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message === 'Load failed' || message.includes('Failed to fetch')) {
    return `Could not reach Cloud Backup API at ${baseUrl}. Restart the frontend if you just updated it, and confirm the Backup API shown in settings is correct.`;
  }

  return message;
}

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cloudSession, setCloudSession] = useState<CloudBackupSession | null>(null);
  const [cloudConfig, setCloudConfig] = useState<CloudRuntimeConfig>(() => getCloudRuntimeConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [authStatus, setAuthStatus] = useState<StatusTone>('idle');
  const [authMessage, setAuthMessage] = useState('');
  const [sessionStatus, setSessionStatus] = useState<StatusTone>('idle');
  const [sessionMessage, setSessionMessage] = useState('');
  const [backupStatus, setBackupStatus] = useState<StatusTone>('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<StatusTone>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const authUrl = cloudConfig.authUrl;
  const backupUrl = cloudConfig.backupUrl;
  const authOrigin = authUrl ? new URL(authUrl).origin : '';
  const cloudConfigError = [
    !authUrl ? 'NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.' : null,
    !backupUrl ? 'NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const refreshCloudConfig = useCallback(async (force = false) => {
    const nextConfig = await loadCloudRuntimeConfig(force);
    setCloudConfig(nextConfig);
    return nextConfig;
  }, []);

  const refreshCloudSession = useCallback(async (cancelled = false) => {
    const state = getCloudAuthState();
    if (!state?.sessionToken) {
      if (!cancelled) {
        setCloudSession(null);
        setSessionStatus('idle');
        setSessionMessage('');
      }
      return;
    }

    setSessionStatus('loading');
    setSessionMessage('Checking cloud session...');

    try {
      const nextConfig = await refreshCloudConfig();
      if (!nextConfig.authUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.');
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${nextConfig.authUrl}/api/me`, {
        headers: createCloudAuthHeaders(),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as CloudBackupSession | null;
      if (cancelled) return;

      if (data?.user && data?.session) {
        const existingState = getCloudAuthState();
        if (existingState) {
          setCloudAuthState({
            ...existingState,
            sessionToken: data.session.token,
            expiresAt: data.session.expiresAt,
            user: data.user,
          });
        }
        setCloudSession(data);
        setSessionStatus('success');
        setSessionMessage(`Signed in as ${data.user.email}`);
      } else {
        setCloudSession(null);
        setSessionStatus('idle');
        setSessionMessage('');
      }
    } catch (error) {
      if (!cancelled) {
        setCloudSession(null);
        setSessionStatus('error');
        setSessionMessage(formatCloudBackupError(error, getCloudRuntimeConfig().authUrl));
      }
    }
  }, [refreshCloudConfig]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [response, nextCloudConfig] = await Promise.all([
          fetch('/api/settings'),
          refreshCloudConfig(true),
        ]);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load settings');
        }

        const nextSettings = data.settings as AppSettings;

        if (cancelled) return;
        setSettings(nextSettings);
        setCloudConfig(nextCloudConfig);
        void refreshCloudSession(cancelled);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshCloudConfig, refreshCloudSession]);

  const updateSyncTime = async (value: string) => {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudBackupLastSyncedAt: value }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update backup timestamp');
    }

    setSettings(data.settings as AppSettings);
  };

  const handleGoogleSignIn = async () => {
    if (!settings) return;

    setAuthStatus('loading');
    setAuthMessage('Opening Google sign-in...');

    try {
      const nextConfig = await refreshCloudConfig();
      const nextAuthOrigin = nextConfig.authUrl ? new URL(nextConfig.authUrl).origin : '';
      if (!nextConfig.authUrl || !nextAuthOrigin) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.');
      }

      const clientOrigin = typeof window !== 'undefined' ? window.location.origin : '/';
      const startUrl = new URL('/auth/popup/start', nextConfig.authUrl);
      startUrl.searchParams.set('client_origin', clientOrigin);

      const popup = window.open(
        startUrl.toString(),
        'bladevault-google-auth',
        'width=500,height=640,menubar=no,toolbar=no'
      );

      if (!popup) {
        throw new Error('Popup was blocked. Allow popups and try again.');
      }

      const result = await new Promise<CloudAuthSuccessMessage>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          window.clearInterval(closedPoll);
          window.clearTimeout(timeout);
        };

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== nextAuthOrigin) return;
          const data = event.data as CloudAuthSuccessMessage | CloudAuthErrorMessage;
          if (!data || typeof data !== 'object' || !('type' in data)) return;

          if (data.type === 'bladevault-auth-error') {
            cleanup();
            reject(new Error(data.error.message || 'Google sign-in failed.'));
            return;
          }
          if (data.type !== 'bladevault-auth-success') return;

          cleanup();
          resolve(data);
        };

        const closedPoll = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error('Google sign-in was closed before completion.'));
          }
        }, 500);

        const timeout = window.setTimeout(() => {
          cleanup();
          try {
            popup.close();
          } catch {
            // ignore
          }
          reject(new Error('Google sign-in timed out. Please try again.'));
        }, 5 * 60 * 1000);

        window.addEventListener('message', onMessage);
      });

      const nextAuthState: CloudAuthState = {
        accessToken: result.accessToken,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      };
      setCloudAuthState(nextAuthState);
      await refreshCloudSession();
      setAuthStatus('success');
      setAuthMessage('Signed in. Cloud backup is ready.');
    } catch (error) {
      setAuthStatus('error');
      setAuthMessage(formatCloudBackupError(error, getCloudRuntimeConfig().authUrl));
    }
  };

  const handleLogout = async () => {
    if (!settings) return;

    setSessionStatus('loading');
    setSessionMessage('Signing out...');

    try {
      const nextConfig = await refreshCloudConfig();
      if (!nextConfig.authUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.');
      }

      const response = await fetch(`${nextConfig.authUrl}/api/auth/sign-out`, {
        method: 'POST',
        headers: createCloudAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setCloudSession(null);
      clearCloudAuthState();
      setSessionStatus('success');
      setSessionMessage('Signed out');
    } catch (error) {
      setSessionStatus('error');
      setSessionMessage(formatCloudBackupError(error, getCloudRuntimeConfig().authUrl));
    }
  };

  const handleBackup = async () => {
    if (!settings) return;

    setBackupStatus('loading');
    setBackupMessage('Uploading your local data folder...');

    try {
      const nextConfig = await refreshCloudConfig();
      if (!nextConfig.backupUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.');
      }

      const accessToken = await refreshCloudBackupAccessToken();

      const archiveResponse = await fetch('/api/cloud-backup/archive', {
        cache: 'no-store',
      });
      if (!archiveResponse.ok) {
        throw new Error(await parseApiError(archiveResponse));
      }

      const archiveBlob = await archiveResponse.blob();
      const response = await fetch(`${nextConfig.backupUrl}/backup/latest`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/gzip',
          'X-Backup-Filename': 'bladevault-data.tar.gz',
        },
        body: archiveBlob,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(details || `Backup upload failed (${response.status})`);
      }

      const now = new Date().toISOString();
      await updateSyncTime(now);
      setBackupStatus('success');
      setBackupMessage('Cloud backup is up to date.');
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage(formatCloudBackupError(error, getCloudRuntimeConfig().backupUrl));
    }
  };

  const handleRestore = async () => {
    if (!settings) return;
    if (
      !window.confirm(
        'Restore from cloud and replace your current local vault on this device?'
      )
    ) {
      return;
    }

    setRestoreStatus('loading');
    setRestoreMessage('Downloading your cloud backup...');

    try {
      const nextConfig = await refreshCloudConfig();
      if (!nextConfig.backupUrl) {
        throw new Error('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL is not configured.');
      }

      const accessToken = await refreshCloudBackupAccessToken();

      const response = await fetch(`${nextConfig.backupUrl}/backup/latest`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(details || `Backup download failed (${response.status})`);
      }

      const archiveBlob = await response.blob();
      const importResponse = await fetch('/api/cloud-backup/archive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/gzip' },
        body: archiveBlob,
      });

      const importData = await importResponse.json();
      if (!importResponse.ok) {
        throw new Error(importData.error || 'Failed to restore cloud backup locally');
      }

      setRestoreStatus('success');
      setRestoreMessage('Cloud backup restored locally. Reloading your vault...');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setRestoreStatus('error');
      setRestoreMessage(formatCloudBackupError(error, getCloudRuntimeConfig().backupUrl));
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,72rem)] max-w-[72rem] sm:max-w-[72rem] flex flex-col overflow-hidden rounded-2xl p-0 shadow-2xl">
        <DialogHeader className="border-b bg-muted/20 px-7 py-5">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {isLoading || !settings ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="flex w-full flex-col overflow-hidden">
            <div className="border-b px-7 pt-4">
              <TabsList className="h-auto flex-wrap gap-1.5 rounded-xl bg-muted/70 p-1">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="cloud-backup" className="gap-2">
                  <span>Cloud Backup</span>
                  <Badge
                    variant="outline"
                    className="h-4 rounded-full border-amber-300 bg-amber-100 px-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800"
                  >
                    Beta
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-7">
              <TabsContent value="general" className="mt-0 w-full space-y-6">
                <Card size="sm" className="w-full rounded-2xl">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                        <Database className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Local Vault</CardTitle>
                        <CardDescription>
                          BladeVault stays local-first and stores your collection on this device.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Knives, compare picks, and downloaded images are saved in your local
                      <strong className="text-foreground"> data/ </strong>
                      folder by default.
                    </p>
                    <p>
                      Use the <strong className="text-foreground">Cloud Backup</strong> tab to sign
                      in through BladeVault Auth and store an off-device copy of your full local
                      data folder.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cloud-backup" className="mt-0 w-full space-y-6">
                <div className="grid w-full gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] 2xl:items-start">
                  <div className="min-w-0 space-y-6">
                    <Card size="sm" className="w-full rounded-2xl">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                            <Cloud className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">Cloud Backup Service</CardTitle>
                            <CardDescription>
                              Sign in through the auth domain, then send your full local data folder to the backup server.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Auth API
                            </Label>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <Input
                                value={authUrl}
                                readOnly
                                className="h-10 min-w-0 flex-1 rounded-xl px-3 text-xs sm:text-sm"
                              />
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="h-10 w-10 shrink-0 self-start rounded-xl sm:self-auto"
                                onClick={() => copyToClipboard(authUrl, 'cloudAuthUrl')}
                              >
                                {copied === 'cloudAuthUrl' ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Backup API
                            </Label>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <Input
                                value={backupUrl}
                                readOnly
                                className="h-10 min-w-0 flex-1 rounded-xl px-3 text-xs sm:text-sm"
                              />
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="h-10 w-10 shrink-0 self-start rounded-xl sm:self-auto"
                                onClick={() => copyToClipboard(backupUrl, 'cloudBackupUrl')}
                              >
                                {copied === 'cloudBackupUrl' ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-3">
                          <div className="min-h-24 rounded-xl border bg-card px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider">Session</div>
                            <div className="mt-2 text-base font-medium text-foreground">
                              {cloudSession ? 'Connected' : 'Not signed in'}
                            </div>
                          </div>
                          <div className="min-h-24 rounded-xl border bg-card px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider">Email</div>
                            <div className="mt-2 break-all text-base font-medium text-foreground">
                              {cloudSession?.user.email || '—'}
                            </div>
                          </div>
                          <div className="min-h-24 rounded-xl border bg-card px-4 py-3 md:col-span-2 lg:col-span-1">
                            <div className="text-[10px] uppercase tracking-wider">Last Sync</div>
                            <div className="mt-2 text-base font-medium text-foreground">
                              {formatSyncTime(settings.cloudBackupLastSyncedAt)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <StatusPill status={sessionStatus} message={sessionMessage} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start rounded-xl sm:self-auto"
                            onClick={() => refreshCloudSession()}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh Session
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {cloudSession && (
                      <Card size="sm" className="w-full rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-sm">Sync Actions</CardTitle>
                          <CardDescription>
                            Upload your full local data folder or restore the latest remote backup archive.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 lg:grid-cols-2">
                            <Button
                              size="sm"
                              className="h-11 rounded-xl text-sm"
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
                              className="h-11 rounded-xl text-sm"
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

                          <div className="space-y-2 rounded-xl border bg-muted/20 px-4 py-3">
                            <StatusPill status={backupStatus} message={backupMessage} />
                            <StatusPill status={restoreStatus} message={restoreMessage} />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="min-w-0 space-y-6">
                    {cloudSession ? (
                      <Card size="sm" className="w-full rounded-2xl xl:sticky xl:top-0">
                        <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm">Account</CardTitle>
                            <CardDescription className="break-all">
                              Signed in as {cloudSession.user.name || cloudSession.user.email}
                            </CardDescription>
                          </div>
                        </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            Cloud backups are tied to this BladeVault account and use the current auth and backup domains shown on the left.
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-full rounded-xl"
                            onClick={handleLogout}
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Sign Out
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card size="sm" className="w-full rounded-2xl xl:sticky xl:top-0">
                        <CardHeader>
                          <CardTitle className="text-sm">Sign In To Cloud Backup</CardTitle>
                          <CardDescription>
                            Use Google on the auth domain, then back up your full local data folder to the backup server.
                          </CardDescription>
                        </CardHeader>
                      <CardContent className="space-y-4">
                        {cloudConfigError && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {cloudConfigError}
                          </div>
                        )}
                        <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                          Your first Google sign-in creates the account automatically. After that,
                            BladeVault can upload and restore your full local data folder, including downloaded images.
                          </div>

                          <Button
                            size="sm"
                            className="h-11 w-full rounded-xl text-sm"
                            onClick={handleGoogleSignIn}
                            disabled={Boolean(cloudConfigError)}
                          >
                            <FcGoogle className="h-4 w-4" />
                            Continue With Google
                          </Button>

                          <div className="space-y-2 rounded-xl border bg-muted/20 px-4 py-3">
                            <StatusPill status={authStatus} message={authMessage} />
                            <p className="text-xs text-muted-foreground">
                              The popup returns a session token for the auth API and a JWT for the backup server.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>

            {loadError && (
              <div className="mx-7 mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-7 py-4">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>
                Close
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
