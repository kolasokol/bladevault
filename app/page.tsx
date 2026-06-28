'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import { KnifeCard } from '@/components/knife-card';
import { SearchField } from '@/components/search-field';
import { useKnives } from '@/components/providers/knives-provider';
import { matchesKnifeSearch } from '@/lib/data';

export default function Dashboard() {
  const { knives } = useKnives();
  const [query, setQuery] = useState('');

  const brandCount = new Set(knives.map((k) => k.brand)).size;
  const latest = knives.length > 0
    ? new Date(
        Math.max(...knives.map((k) => new Date(k.addedAt).getTime()))
      ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

  const visibleKnives = knives.filter((k) => matchesKnifeSearch(k, query));

  return (
    <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader
        title="Collection Dashboard"
        description="Overview of your private knife library."
        actions={
          knives.length > 0 ? (
            <Button variant="outline" size="sm" render={<Link href="/collection">View all</Link>} nativeButton={false} />
          ) : undefined
        }
      />

      {knives.length > 0 && (
        <div className="mb-8">
          <SearchField value={query} onChange={setQuery} />
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Knives" value={knives.length} hint="In your library" />
        <StatCard label="Brands" value={brandCount} hint="Unique makers" />
        <StatCard label="Latest Added" value={latest} hint="Most recent entry" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-tight text-[var(--bladevault-title)]">Recently Added</h2>
      </div>

      {knives.length === 0 ? (
        <EmptyState
          title="No knives yet"
          description="Your collection is empty. Use Quick Add to add your first knife."
        />
      ) : visibleKnives.length === 0 ? (
        <EmptyState
          title="No matches found"
          description={`Nothing matches "${query}". Try a different brand or model.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {visibleKnives.map((knife) => (
            <KnifeCard key={knife.id} knife={knife} />
          ))}
        </div>
      )}
    </div>
  );
}
