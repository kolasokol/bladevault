'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { KnifeCard } from '@/components/knife-card';
import { EmptyState } from '@/components/empty-state';
import { SearchField } from '@/components/search-field';
import { useKnives } from '@/components/providers/knives-provider';
import { matchesKnifeSearch } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function CollectionContent() {
  const { knives } = useKnives();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');

  const brandFilter = searchParams.get('brand') ?? '';
  const handleFilter = searchParams.get('handle') ?? '';

  const handles = useMemo(
    () => Array.from(new Set(knives.map((k) => k.handleMaterial))).filter(Boolean).sort(),
    [knives]
  );

  const filteredKnives = useMemo(() => {
    return knives.filter((knife) => {
      if (brandFilter && knife.brand !== brandFilter) return false;
      if (handleFilter && knife.handleMaterial !== handleFilter) return false;
      if (!matchesKnifeSearch(knife, query)) return false;
      return true;
    });
  }, [knives, brandFilter, handleFilter, query]);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const clearFilters = () => {
    router.push(pathname);
    setQuery('');
  };

  const activeFilters = [
    { key: 'brand', value: brandFilter },
    { key: 'handle', value: handleFilter },
  ].filter((f) => f.value) as { key: string; value: string }[];

  const hasActiveFilters = activeFilters.length > 0 || query.trim().length > 0;

  return (
    <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader
        title="My Library"
        description="Manage and browse your complete knife inventory."
      />

      {knives.length > 0 && (
        <div className="mb-6">
          <SearchField value={query} onChange={setQuery} />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="gap-1 pr-1 text-xs capitalize"
            >
              <span className="text-muted-foreground">{filter.key}:</span>
              {filter.value}
              <button
                onClick={() => setFilter(filter.key, '')}
                className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Clear ${filter.key} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {query.trim() && (
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              <span className="text-muted-foreground">search:</span>
              {query.trim()}
              <button
                onClick={() => setQuery('')}
                className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={handleFilter} onValueChange={(value) => setFilter('handle', value ?? '')}>
            <SelectTrigger className="w-44" size="sm">
              <SelectValue placeholder="All handles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All handles</SelectItem>
              {handles.map((handle) => (
                <SelectItem key={handle} value={handle}>
                  {handle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredKnives.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No matches found' : 'Your library is empty'}
          description={
            hasActiveFilters
              ? 'Try clearing the search or filters to see more results.'
              : 'Add a knife to start building your collection.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKnives.map((knife) => (
            <KnifeCard key={knife.id} knife={knife} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <PageHeader title="My Library" description="Manage and browse your complete knife inventory." />
          <div className="h-96 rounded-xl border border-dashed bg-muted/50" />
        </div>
      }
    >
      <CollectionContent />
    </Suspense>
  );
}
