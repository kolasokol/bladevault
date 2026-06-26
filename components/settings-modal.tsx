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
import { getImageUrl, type Knife } from '@/lib/data';
import { AppSettings } from '@/lib/settings';
import {
  clearCloudBackupAuthToken,
  CloudBackupSession,
  createCloudBackupHeaders,
  getCloudBackupUrl,
  parseApiError,
  setCloudBackupAuthToken,
} from '@/lib/cloud-backup';
import { Button } from '@/components/ui/button';
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
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {message || 'Working...'}
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message || 'Done'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" />
      {message || 'Something went wrong'}
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

function createPopupNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFilenameFromImagePath(image: string) {
  const parts = image.split('/');
  return parts[parts.length - 1] || 'image.jpg';
}

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cloudSession, setCloudSession] = useState<CloudBackupSession | null>(null);
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

  const refreshCloudSession = useCallback(async (cloudBackupUrl?: string, cancelled = false) => {
    const baseUrl = getCloudBackupUrl(cloudBackupUrl || settings?.cloudBackupUrl);
    setSessionStatus('loading');
    setSessionMessage('Checking cloud session...');

    try {
      const response = await fetch(`${baseUrl}/api/auth/get-session`, {
        credentials: 'include',
        headers: createCloudBackupHeaders(),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as CloudBackupSession | null;
      if (cancelled) return;

      if (data?.user && data?.session) {
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
        setSessionMessage(formatCloudBackupError(error, baseUrl));
      }
    }
  }, [settings?.cloudBackupUrl]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load settings');
        }

        const nextSettings = data.settings as AppSettings;

        if (cancelled) return;
        setSettings(nextSettings);
        await refreshCloudSession(nextSettings.cloudBackupUrl, cancelled);
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
  }, [isOpen, refreshCloudSession]);

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
      const baseUrl = getCloudBackupUrl(settings.cloudBackupUrl);
      const callbackURL = typeof window !== 'undefined' ? window.location.origin : '/';
      const popupOrigin = callbackURL;
      const popupNonce = createPopupNonce();
      const startUrl = new URL(`${baseUrl}/api/auth/oauth-popup/start`);
      startUrl.searchParams.set('provider', 'google');
      startUrl.searchParams.set('popupOrigin', popupOrigin);
      startUrl.searchParams.set('popupNonce', popupNonce);
      startUrl.searchParams.set('callbackURL', callbackURL);
      startUrl.searchParams.set('errorCallbackURL', callbackURL);
      startUrl.searchParams.set('newUserCallbackURL', callbackURL);

      const popup = window.open(
        startUrl.toString(),
        'bladevault-google-auth',
        'width=500,height=640,menubar=no,toolbar=no'
      );

      if (!popup) {
        throw new Error('Popup was blocked. Allow popups and try again.');
      }

      const result = await new Promise<{ token?: string; error?: string }>((resolve) => {
        let settled = false;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          window.clearInterval(closedPoll);
          window.clearTimeout(timeout);
        };

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== baseUrl) return;
          const data = event.data as {
            type?: string;
            nonce?: string;
            token?: string;
            error?: { code?: string; description?: string };
          };
          if (data?.type !== 'better-auth:oauth-popup' || data?.nonce !== popupNonce) return;
          cleanup();
          if (data.error) {
            resolve({ error: data.error.description || data.error.code || 'Google sign-in failed.' });
            return;
          }
          resolve({ token: data.token });
        };

        const closedPoll = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            resolve({ error: 'Google sign-in was closed before completion.' });
          }
        }, 500);

        const timeout = window.setTimeout(() => {
          cleanup();
          try {
            popup.close();
          } catch {
            // ignore
          }
          resolve({ error: 'Google sign-in timed out. Please try again.' });
        }, 5 * 60 * 1000);

        window.addEventListener('message', onMessage);
      });

      if (!result.token) {
        throw new Error(result.error || 'Google sign-in did not return a session token.');
      }

      setCloudBackupAuthToken(result.token);
      await refreshCloudSession(settings.cloudBackupUrl);
      setAuthStatus('success');
      setAuthMessage('Signed in. Cloud backup is ready.');
    } catch (error) {
      setAuthStatus('error');
      setAuthMessage(formatCloudBackupError(error, getCloudBackupUrl(settings.cloudBackupUrl)));
    }
  };

  const handleLogout = async () => {
    if (!settings) return;

    setSessionStatus('loading');
    setSessionMessage('Signing out...');

    try {
      const baseUrl = getCloudBackupUrl(settings.cloudBackupUrl);
      const response = await fetch(`${baseUrl}/api/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
        headers: createCloudBackupHeaders(),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setCloudSession(null);
      clearCloudBackupAuthToken();
      setSessionStatus('success');
      setSessionMessage('Signed out');
    } catch (error) {
      setSessionStatus('error');
      setSessionMessage(formatCloudBackupError(error, getCloudBackupUrl(settings.cloudBackupUrl)));
    }
  };

  const handleBackup = async () => {
    if (!settings) return;

    setBackupStatus('loading');
    setBackupMessage('Uploading your local vault...');

    try {
      const baseUrl = getCloudBackupUrl(settings.cloudBackupUrl);
      const snapshotResponse = await fetch('/api/cloud-backup/snapshot?inlineImages=false');
      const snapshotData = await snapshotResponse.json();

      if (!snapshotResponse.ok) {
        throw new Error(snapshotData.error || 'Failed to read local snapshot');
      }

      const normalizedKnives = await Promise.all(
        ((snapshotData.knives ?? []) as Knife[]).map(async (knife) => {
          const uploadedImages: string[] = [];

          for (const image of knife.images ?? []) {
            if (image.startsWith('http://') || image.startsWith('https://')) {
              uploadedImages.push(image);
              continue;
            }

            if (image.startsWith('data:image/')) {
              const imageResponse = await fetch(`${baseUrl}/api/v1/images/data-url`, {
                method: 'POST',
                credentials: 'include',
                headers: createCloudBackupHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                  knifeId: knife.id,
                  dataUrl: image,
                  filename: 'image-upload',
                }),
              });

              if (!imageResponse.ok) {
                throw new Error(await parseApiError(imageResponse));
              }

              const imageData = (await imageResponse.json()) as { publicUrl?: string };
              if (!imageData.publicUrl) {
                throw new Error('Image upload did not return a public URL.');
              }

              uploadedImages.push(imageData.publicUrl);
              continue;
            }

            const localImageResponse = await fetch(getImageUrl(image));
            if (!localImageResponse.ok) {
              throw new Error(`Failed to read local image ${image}`);
            }

            const imageBlob = await localImageResponse.blob();
            const formData = new FormData();
            formData.append('knifeId', knife.id);
            formData.append('filename', getFilenameFromImagePath(image));
            formData.append('file', imageBlob, getFilenameFromImagePath(image));

            const uploadResponse = await fetch(`${baseUrl}/api/v1/images/upload`, {
              method: 'POST',
              credentials: 'include',
              headers: createCloudBackupHeaders(),
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(await parseApiError(uploadResponse));
            }

            const uploadData = (await uploadResponse.json()) as { publicUrl?: string };
            if (!uploadData.publicUrl) {
              throw new Error('Image upload did not return a public URL.');
            }

            uploadedImages.push(uploadData.publicUrl);
          }

          return {
            ...knife,
            images: uploadedImages,
          };
        })
      );

      const response = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        credentials: 'include',
        headers: createCloudBackupHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          knives: normalizedKnives,
          compareIds: snapshotData.compareIds ?? [],
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const now = new Date().toISOString();
      await updateSyncTime(now);
      setBackupStatus('success');
      setBackupMessage('Cloud backup is up to date.');
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage(formatCloudBackupError(error, getCloudBackupUrl(settings.cloudBackupUrl)));
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
      const baseUrl = getCloudBackupUrl(settings.cloudBackupUrl);
      const response = await fetch(`${baseUrl}/api/v1/sync/pull`, {
        credentials: 'include',
        headers: createCloudBackupHeaders(),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const snapshot = await response.json();
      const importResponse = await fetch('/api/cloud-backup/snapshot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knives: snapshot.knives ?? [],
          compareIds: snapshot.compareIds ?? [],
        }),
      });

      const importData = await importResponse.json();
      if (!importResponse.ok) {
        throw new Error(importData.error || 'Failed to restore cloud snapshot locally');
      }

      setRestoreStatus('success');
      setRestoreMessage('Cloud backup restored locally. Reloading your vault...');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setRestoreStatus('error');
      setRestoreMessage(formatCloudBackupError(error, getCloudBackupUrl(settings.cloudBackupUrl)));
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {isLoading || !settings ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="flex flex-col overflow-hidden">
            <div className="px-6 pt-4 border-b">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="cloud-backup">Cloud Backup</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <TabsContent value="general" className="mt-0 space-y-6">
                <Card size="sm">
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
                      Knives, compare picks, and downloaded images are saved to your local SQLite
                      database and image folder by default.
                    </p>
                    <p>
                      Use the <strong className="text-foreground">Cloud Backup</strong> tab to sign
                      in and sync a copy of your vault to your BladeVault backend.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cloud-backup" className="mt-0 space-y-6">
                <Card size="sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                        <Cloud className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Cloud Backup Service</CardTitle>
                        <CardDescription>
                          Sign in to sync your local vault with BladeVault Cloud.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Backup API
                      </Label>
                      <div className="flex gap-2">
                        <Input value={settings.cloudBackupUrl} readOnly />
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => copyToClipboard(settings.cloudBackupUrl, 'cloudBackupUrl')}
                        >
                          {copied === 'cloudBackupUrl' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                      <div className="rounded-lg border bg-card px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider">Session</div>
                        <div className="mt-1 font-medium text-foreground">
                          {cloudSession ? 'Connected' : 'Not signed in'}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-card px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider">Email</div>
                        <div className="mt-1 font-medium text-foreground">
                          {cloudSession?.user.email || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-card px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider">Last Sync</div>
                        <div className="mt-1 font-medium text-foreground">
                          {formatSyncTime(settings.cloudBackupLastSyncedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <StatusPill status={sessionStatus} message={sessionMessage} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshCloudSession(settings.cloudBackupUrl)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {cloudSession ? (
                  <>
                    <Card size="sm">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">Account</CardTitle>
                            <CardDescription>
                              Signed in as {cloudSession.user.name || cloudSession.user.email}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          Backups run under your BladeVault account on the staging backend.
                        </div>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                          <LogOut className="h-3.5 w-3.5" />
                          Sign Out
                        </Button>
                      </CardContent>
                    </Card>

                    <Card size="sm">
                      <CardHeader>
                        <CardTitle className="text-sm">Sync Actions</CardTitle>
                        <CardDescription>
                          Push your local vault to the cloud or restore the latest cloud copy.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                          Cloud backup does not change where BladeVault stores your everyday data.
                          It keeps a synced copy on your account so you can restore later.
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Button size="sm" onClick={handleBackup} disabled={backupStatus === 'loading'}>
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

                        <div className="space-y-2">
                          <StatusPill status={backupStatus} message={backupMessage} />
                          <StatusPill status={restoreStatus} message={restoreMessage} />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle className="text-sm">Sign In To Cloud Backup</CardTitle>
                      <CardDescription>
                        Use Google to create or access your BladeVault Cloud backup account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                        Your first Google sign-in creates the account automatically. No password or
                        email verification step is needed.
                      </div>

                      <Button size="sm" onClick={handleGoogleSignIn}>
                        <FcGoogle className="h-4 w-4" />
                        Continue With Google
                      </Button>

                      <div className="space-y-2">
                        <StatusPill status={authStatus} message={authMessage} />
                        <p className="text-xs text-muted-foreground">
                          After Google returns to BladeVault, open Cloud Backup again to confirm
                          the session is connected.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>

            {loadError && (
              <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
