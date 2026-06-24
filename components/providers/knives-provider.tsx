'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Knife, KnifeDraft, KnifeUpdates } from '@/lib/data';

type KnivesContextValue = {
  knives: Knife[];
  addKnife: (draft: KnifeDraft) => Promise<Knife>;
  updateKnife: (id: string, updates: KnifeUpdates) => Promise<Knife>;
  deleteKnife: (id: string) => Promise<void>;
  isLoading: boolean;
  compareIds: string[];
  addToCompare: (id: string) => Promise<void>;
  removeFromCompare: (id: string) => Promise<void>;
};

const KnivesContext = createContext<KnivesContextValue | null>(null);

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
    return knife;
  }, []);

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
      }}
    >
      {children}
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
