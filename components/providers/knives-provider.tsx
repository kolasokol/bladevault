'use client';

import { CheckCircle2, Cloud } from 'lucide-react';
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Knife, KnifeDraft, KnifeUpdates } from '@/lib/data';
import {
  CLOUD_AUTH_STATE_EVENT,
  getCloudAuthState,
} from '@/lib/cloud-backup';
import { DEFAULT_SETTINGS, SETTINGS_UPDATED_EVENT } from '@/lib/settings-shared';
import {
  canAttemptSilentCloudBackup,
  uploadCloudBackupArchive,
} from '@/lib/cloud-backup-client';

type KnivesContextValue = {
  knives: Knife[];
  addKnife: (draft: KnifeDraft) => Promise<Knife>;
  updateKnife: (id: string, updates: KnifeUpdates) => Promise<Knife>;
  deleteKnife: (id: string) => Promise<void>;
  isLoading: boolean;
  compareIds: string[];
  addToCompare: (id: string) => Promise<void>;
  removeFromCompare: (id: string) => Promise<void>;
  isCloudSyncEnabled: boolean;
  isAutoBackupEnabled: boolean;
  isAutoBackupActive: boolean;
};

const KnivesContext = createContext<KnivesContextValue | null>(null);
const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000;
const BACKUP_NOTICE_DURATION_MS = 3200;

function toImageUrls(draft: KnifeDraft): string[] {
  return draft.images.filter(
    (src): src is string =>
      typeof src === 'string' && (src.startsWith('http') || src.startsWith('data:image'))
  );
}

export function KnivesProvider({ children }: { children: React.ReactNode }) {
  const [knives, setKnives] = useState<Knife[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backupNotice, setBackupNotice] = useState<{ id: number; message: string } | null>(null);
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(() =>
    Boolean(getCloudAuthState()?.sessionToken)
  );
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(
    DEFAULT_SETTINGS.cloudAutoBackupEnabled
  );
  const backupInFlightRef = useRef(false);
  const pendingBackupRef = useRef(false);
  const runAutoBackupRef = useRef<(reason: 'hourly' | 'item-added' | 'queued') => Promise<void>>(
    async () => {}
  );

  useEffect(() => {
    let cancelled = false;

    const syncAutoBackupSetting = async () => {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load settings');
        }

        if (!cancelled) {
          setIsAutoBackupEnabled(Boolean(data.settings?.cloudAutoBackupEnabled));
        }
      } catch {
        if (!cancelled) {
          setIsAutoBackupEnabled(DEFAULT_SETTINGS.cloudAutoBackupEnabled);
        }
      }
    };

    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ cloudAutoBackupEnabled?: boolean }>).detail;
      if (typeof detail?.cloudAutoBackupEnabled === 'boolean') {
        setIsAutoBackupEnabled(detail.cloudAutoBackupEnabled);
        return;
      }

      void syncAutoBackupSetting();
    };

    void syncAutoBackupSetting();
    window.addEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    const syncCloudAuthState = () => {
      setIsCloudSyncEnabled(Boolean(getCloudAuthState()?.sessionToken));
    };

    syncCloudAuthState();
    window.addEventListener(CLOUD_AUTH_STATE_EVENT, syncCloudAuthState);
    window.addEventListener('storage', syncCloudAuthState);

    return () => {
      window.removeEventListener(CLOUD_AUTH_STATE_EVENT, syncCloudAuthState);
      window.removeEventListener('storage', syncCloudAuthState);
    };
  }, []);

  const showBackupNotice = useCallback((message: string) => {
    startTransition(() => {
      setBackupNotice({
        id: Date.now(),
        message,
      });
    });
  }, []);

  const runAutoBackup = useCallback(async (reason: 'hourly' | 'item-added' | 'queued') => {
    if (!canAttemptSilentCloudBackup()) {
      return;
    }

    if (backupInFlightRef.current) {
      pendingBackupRef.current = true;
      return;
    }

    backupInFlightRef.current = true;

    try {
      await uploadCloudBackupArchive();
      showBackupNotice(reason === 'hourly' ? 'Hourly backup complete' : 'Backup complete');
    } catch (error) {
      console.error('Automatic cloud backup failed', error);
    } finally {
      backupInFlightRef.current = false;

      if (pendingBackupRef.current) {
        pendingBackupRef.current = false;
        window.setTimeout(() => {
          void runAutoBackupRef.current('queued');
        }, 0);
      }
    }
  }, [showBackupNotice]);

  useEffect(() => {
    runAutoBackupRef.current = runAutoBackup;
  }, [runAutoBackup]);

  const scheduleAutoBackup = useCallback((reason: 'hourly' | 'item-added') => {
    window.setTimeout(() => {
      void runAutoBackup(reason);
    }, 0);
  }, [runAutoBackup]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [knivesResponse, compareResponse] = await Promise.all([
          fetch('/api/knives'),
          fetch('/api/compare'),
        ]);
        const knivesData = await knivesResponse.json();
        const compareData = await compareResponse.json();
        if (!cancelled) {
          if (Array.isArray(knivesData.knives)) {
            setKnives(knivesData.knives);
          }
          if (Array.isArray(compareData.compareIds)) {
            setCompareIds(compareData.compareIds);
          }
        }
      } catch {
        // keep empty state on error
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
  }, []);

  useEffect(() => {
    if (!backupNotice) return;

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setBackupNotice((current) => (current?.id === backupNotice.id ? null : current));
      });
    }, BACKUP_NOTICE_DURATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [backupNotice]);

  useEffect(() => {
    if (!isCloudSyncEnabled || !isAutoBackupEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      scheduleAutoBackup('hourly');
    }, AUTO_BACKUP_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAutoBackupEnabled, isCloudSyncEnabled, scheduleAutoBackup]);

  const addKnife = useCallback(async (draft: KnifeDraft): Promise<Knife> => {
    const response = await fetch('/api/knives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        brand: draft.brand,
        bladeStyle: draft.bladeStyle,
        handleMaterial: draft.handleMaterial,
        description: draft.description,
        specs: draft.specs,
        imageUrls: toImageUrls(draft),
        sourceUrl: draft.sourceUrl,
        pinned: draft.pinned,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to save knife');
    }

    const data = await response.json();
    const knife = data.knife as Knife;
    setKnives((prev) => [knife, ...prev]);
    if (isCloudSyncEnabled && isAutoBackupEnabled) {
      scheduleAutoBackup('item-added');
    }
    return knife;
  }, [isAutoBackupEnabled, isCloudSyncEnabled, scheduleAutoBackup]);

  const updateKnife = useCallback(async (id: string, updates: KnifeUpdates): Promise<Knife> => {
    const response = await fetch(`/api/knives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to update knife');
    }

    const data = await response.json();
    const knife = data.knife as Knife;
    setKnives((prev) => prev.map((k) => (k.id === id ? knife : k)));
    return knife;
  }, []);

  const deleteKnife = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/knives/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to delete knife');
    }

    setKnives((prev) => prev.filter((k) => k.id !== id));
    setCompareIds((prev) => prev.filter((cid) => cid !== id));
  }, []);

  const addToCompare = useCallback(async (id: string): Promise<void> => {
    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to add to compare');
    }

    const data = await response.json();
    if (Array.isArray(data.compareIds)) {
      setCompareIds(data.compareIds);
    }
  }, []);

  const removeFromCompare = useCallback(async (id: string): Promise<void> => {
    const response = await fetch('/api/compare', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? 'Failed to remove from compare');
    }

    const data = await response.json();
    if (Array.isArray(data.compareIds)) {
      setCompareIds(data.compareIds);
    }
  }, []);

  return (
    <KnivesContext.Provider
      value={{
        knives,
        addKnife,
        updateKnife,
        deleteKnife,
        isLoading,
        compareIds,
        addToCompare,
        removeFromCompare,
        isCloudSyncEnabled,
        isAutoBackupEnabled,
        isAutoBackupActive: isCloudSyncEnabled && isAutoBackupEnabled,
      }}
    >
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50">
        {backupNotice && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-lg backdrop-blur dark:border-emerald-900/60 dark:bg-slate-950/95 dark:text-slate-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <Cloud className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span>{backupNotice.message}</span>
              </div>
              <p className="text-xs text-muted-foreground">Your vault was synced in the background.</p>
            </div>
          </div>
        )}
      </div>
    </KnivesContext.Provider>
  );
}

export function useKnives(): KnivesContextValue {
  const context = useContext(KnivesContext);
  if (!context) {
    throw new Error('useKnives must be used within a KnivesProvider');
  }
  return context;
}
