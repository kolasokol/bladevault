'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Cloud,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { AppSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

function StatusPill({ status, message }: { status: TestStatus; message?: string }) {
  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Testing...
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message || 'Connected'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {message || 'Failed'}
    </span>
  );
}

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [d1Status, setD1Status] = useState<TestStatus>('idle');
  const [d1Message, setD1Message] = useState('');
  const [r2Status, setR2Status] = useState<TestStatus>('idle');
  const [r2Message, setR2Message] = useState('');

  const [migrateStatus, setMigrateStatus] = useState<TestStatus>('idle');
  const [migrateMessage, setMigrateMessage] = useState('');
  const [migrateResult, setMigrateResult] = useState<{ total: number; migrated: number; failed: number } | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (!cancelled && data.settings) {
          setSettings(data.settings);
        }
      } catch {
        if (!cancelled) setSaveError('Failed to load settings');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const updateField = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);

      window.location.reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (test: 'd1' | 'r2') => {
    if (!settings) return;

    if (test === 'd1') {
      setD1Status('loading');
      setD1Message('');
    } else {
      setR2Status('loading');
      setR2Message('');
    }

    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, ...settings }),
      });

      const data = await response.json();

      if (test === 'd1') {
        setD1Status(data.ok ? 'success' : 'error');
        setD1Message(data.error || 'Connected');
      } else {
        setR2Status(data.ok ? 'success' : 'error');
        setR2Message(data.error || 'Connected');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      if (test === 'd1') {
        setD1Status('error');
        setD1Message(message);
      } else {
        setR2Status('error');
        setR2Message(message);
      }
    }
  };

  const handleMigrate = async () => {
    setMigrateStatus('loading');
    setMigrateMessage('');
    setMigrateResult(null);

    try {
      const response = await fetch('/api/settings/migrate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setMigrateStatus('success');
      setMigrateResult(data.result);
      setMigrateMessage(`Migrated ${data.result.migrated} of ${data.result.total} knives`);
    } catch (error) {
      setMigrateStatus('error');
      setMigrateMessage(error instanceof Error ? error.message : 'Migration failed');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
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
                <TabsTrigger value="d1">Cloudflare D1</TabsTrigger>
                <TabsTrigger value="r2">Cloudflare R2</TabsTrigger>
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
                        <CardTitle className="text-sm">Storage Mode</CardTitle>
                        <CardDescription>Choose where knives and images are stored</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateField('storageMode', 'local')}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                          settings.storageMode === 'local'
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-border bg-card hover:border-ring'
                        }`}
                      >
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className={`text-xs font-semibold uppercase tracking-wide ${settings.storageMode === 'local' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>Local</div>
                          <div className="text-[10px] text-muted-foreground">SQLite + filesystem</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateField('storageMode', 'remote')}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                          settings.storageMode === 'remote'
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-border bg-card hover:border-ring'
                        }`}
                      >
                        <Cloud className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className={`text-xs font-semibold uppercase tracking-wide ${settings.storageMode === 'remote' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>Remote</div>
                          <div className="text-[10px] text-muted-foreground">Cloudflare D1 + R2</div>
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {settings.storageMode === 'remote' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p>Switching to Remote will make the app read from and write to Cloudflare. Your local data stays untouched.</p>
                        <p>After saving, use the <strong>Migrate Data</strong> button to copy existing local knives and images to Cloudflare.</p>
                      </div>
                    </div>
                  </div>
                )}

              </TabsContent>

              <TabsContent value="d1" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cloudflare Account ID</Label>
                  <Input value={settings.cloudflareAccountId} onChange={(e) => updateField('cloudflareAccountId', e.target.value)} placeholder="e.g. 1a2b3c4d..." />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cloudflare API Token <span className="font-normal normal-case text-muted-foreground/70">(Account → D1 → Edit)</span>
                  </Label>
                  <Input value={settings.cloudflareApiToken} onChange={(e) => updateField('cloudflareApiToken', e.target.value)} placeholder="API token" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">D1 Database Name</Label>
                    <Input value={settings.d1DatabaseName} onChange={(e) => updateField('d1DatabaseName', e.target.value)} placeholder="bladevault" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">D1 Database ID</Label>
                    <Input value={settings.d1DatabaseId} onChange={(e) => updateField('d1DatabaseId', e.target.value)} placeholder="UUID" />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <StatusPill status={d1Status} message={d1Message} />
                  <Button size="sm" onClick={() => testConnection('d1')} disabled={d1Status === 'loading'}>
                    {d1Status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Test D1
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="r2" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">R2 Bucket Name</Label>
                  <Input value={settings.r2BucketName} onChange={(e) => updateField('r2BucketName', e.target.value)} placeholder="bladevault-images" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    R2 Bucket URL <span className="font-normal normal-case text-muted-foreground/70">(public URL)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input value={settings.r2BucketUrl} onChange={(e) => updateField('r2BucketUrl', e.target.value)} placeholder="https://pub-123.r2.dev" />
                    <Button variant="outline" size="icon-sm" onClick={() => copyToClipboard(settings.r2BucketUrl, 'bucketUrl')}>
                      {copied === 'bucketUrl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">R2 Endpoint</Label>
                  <Input value={settings.r2Endpoint} onChange={(e) => updateField('r2Endpoint', e.target.value)} placeholder="https://<account>.r2.cloudflarestorage.com" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Access Key ID</Label>
                    <Input value={settings.r2AccessKeyId} onChange={(e) => updateField('r2AccessKeyId', e.target.value)} placeholder="Access key" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Secret Access Key</Label>
                    <Input type="password" value={settings.r2SecretAccessKey} onChange={(e) => updateField('r2SecretAccessKey', e.target.value)} placeholder="Secret key" />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <StatusPill status={r2Status} message={r2Message} />
                  <Button size="sm" onClick={() => testConnection('r2')} disabled={r2Status === 'loading'}>
                    {r2Status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Test R2
                  </Button>
                </div>
              </TabsContent>

              {settings.storageMode === 'remote' && (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm">Migrate Local Data</CardTitle>
                    <CardDescription>Copy all local knives and images to Cloudflare</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMigrate}
                      disabled={migrateStatus === 'loading'}
                      className="w-full"
                    >
                      {migrateStatus === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {migrateStatus === 'success' ? 'Migration Complete' : 'Migrate Local → Remote'}
                    </Button>

                    <StatusPill status={migrateStatus} message={migrateMessage} />

                    {migrateResult && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Total knives: {migrateResult.total}</div>
                        <div className="text-emerald-600 dark:text-emerald-400">Migrated: {migrateResult.migrated}</div>
                        {migrateResult.failed > 0 && (
                          <div className="text-destructive">Failed: {migrateResult.failed}</div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {saveError && (
              <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !settings}>
                {saveSuccess ? <CheckCircle2 className="h-3.5 w-3.5" /> : isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {saveSuccess ? 'Saved' : isSaving ? 'Saving' : 'Save Settings'}
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
