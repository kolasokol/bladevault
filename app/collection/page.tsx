'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { KnifeCard } from '@/components/knife-card';
import { EmptyState } from '@/components/empty-state';
import { FilterMultiSelect } from '@/components/filter-multi-select';
import { SearchField } from '@/components/search-field';
import { useKnives } from '@/components/providers/knives-provider';
import { Knife, matchesKnifeSearch } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const filterDefinitions = [
  { key: 'brand', label: 'Brand', getValue: (knife: Knife) => knife.brand },
  { key: 'modelNumber', label: 'Model Number', getValue: (knife: Knife) => knife.specs.modelNumber },
  { key: 'bladeMaterial', label: 'Blade Material', getValue: (knife: Knife) => knife.specs.bladeMaterial },
  { key: 'bladeStyle', label: 'Blade Style', getValue: (knife: Knife) => knife.bladeStyle },
  { key: 'bladeCoating', label: 'Blade Coating / Finish', getValue: (knife: Knife) => knife.specs.bladeCoating },
  { key: 'hardness', label: 'Hardness', getValue: (knife: Knife) => knife.specs.hardness },
  { key: 'lockingMechanism', label: 'Locking Mechanism', getValue: (knife: Knife) => knife.specs.lockingMechanism },
  { key: 'handleMaterial', label: 'Handle Material', getValue: (knife: Knife) => knife.handleMaterial },
  { key: 'handleLength', label: 'Handle Length', getValue: (knife: Knife) => knife.specs.handleLength },
  { key: 'bladeLength', label: 'Blade Length', getValue: (knife: Knife) => knife.specs.bladeLength },
  { key: 'overallLength', label: 'Overall Length', getValue: (knife: Knife) => knife.specs.overallLength },
  { key: 'bladeThickness', label: 'Blade Thickness', getValue: (knife: Knife) => knife.specs.bladeThickness },
  { key: 'weight', label: 'Weight', getValue: (knife: Knife) => knife.specs.weight },
  { key: 'country', label: 'Country', getValue: (knife: Knife) => knife.specs.country },
] as const;

type FilterKey = (typeof filterDefinitions)[number]['key'];

function CollectionContent() {
  const { knives } = useKnives();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');

  const selectedFilters = useMemo(
    () =>
      Object.fromEntries(
        filterDefinitions.map((definition) => [
          definition.key,
          searchParams.getAll(definition.key).filter(Boolean),
        ])
      ) as Record<FilterKey, string[]>,
    [searchParams]
  );

  const optionsByFilter = useMemo(
    () =>
      Object.fromEntries(
        filterDefinitions.map((definition) => [
          definition.key,
          Array.from(
            new Set(
              knives
                .map((knife) => definition.getValue(knife))
                .filter((value): value is string => Boolean(value && value.trim().length > 0))
            )
          ).sort((left, right) => left.localeCompare(right)),
        ])
      ) as Record<FilterKey, string[]>,
    [knives]
  );

  const filteredKnives = useMemo(() => {
    return knives.filter((knife) => {
      if (!matchesKnifeSearch(knife, query)) return false;

      return filterDefinitions.every((definition) => {
        const selectedValues = selectedFilters[definition.key];

        if (selectedValues.length === 0) {
          return true;
        }

        const value = definition.getValue(knife);
        return Boolean(value && selectedValues.includes(value));
      });
    });
  }, [knives, query, selectedFilters]);

  const setFilterValues = (key: FilterKey, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);

    values.forEach((value) => {
      params.append(key, value);
    });

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const toggleFilterValue = (key: FilterKey, value: string) => {
    const currentValues = selectedFilters[key];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((currentValue) => currentValue !== value)
      : [...currentValues, value];

    setFilterValues(key, nextValues);
  };

  const clearAllFilters = () => {
    router.replace(pathname);
    setQuery('');
  };

  const activeFilters = filterDefinitions.flatMap((definition) =>
    selectedFilters[definition.key].map((value) => ({
      key: definition.key,
      label: definition.label,
      value,
    }))
  );

  const hasActiveFilters = activeFilters.length > 0 || query.trim().length > 0;

  return (
    <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader
        title="My Library"
        description="Manage and browse your complete knife inventory."
      />

      {knives.length > 0 && (
        <div className="mb-4">
          <SearchField value={query} onChange={setQuery} />
        </div>
      )}

      {knives.length > 0 && (
        <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {filterDefinitions.map((definition) => (
            <FilterMultiSelect
              key={definition.key}
              label={definition.label}
              options={optionsByFilter[definition.key]}
              selectedValues={selectedFilters[definition.key]}
              onToggleValue={(value) => toggleFilterValue(definition.key, value)}
              onClear={() => setFilterValues(definition.key, [])}
            />
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={`${filter.key}-${filter.value}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <span className="text-muted-foreground">{filter.label}:</span>
              {filter.value}
              <button
                onClick={() =>
                  setFilterValues(
                    filter.key,
                    selectedFilters[filter.key].filter((value) => value !== filter.value)
                  )
                }
                className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Clear ${filter.label} filter value ${filter.value}`}
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
            <Button variant="ghost" size="xs" onClick={clearAllFilters}>
              Clear all
            </Button>
          )}
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
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
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
