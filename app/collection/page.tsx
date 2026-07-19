'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { KnifeCard } from '@/components/knife-card'
import { EmptyState } from '@/components/empty-state'
import { FilterMultiSelect } from '@/components/filter-multi-select'
import { SearchField } from '@/components/search-field'
import { useKnives } from '@/components/providers/knives-provider'
import { Knife, matchesKnifeSearch, prioritizePinnedKnives } from '@/lib/data'
import { CustomField, CustomFieldType } from '@/lib/settings-shared'
import { readJsonResponse } from '@/lib/api-response'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 24

const builtInFilterDefinitions = [
  { key: 'brand', label: 'Brand', getValue: (knife: Knife) => knife.brand },
  {
    key: 'modelNumber',
    label: 'Model Number',
    getValue: (knife: Knife) => knife.specs.modelNumber,
  },
  {
    key: 'bladeMaterial',
    label: 'Blade Material',
    getValue: (knife: Knife) => knife.specs.bladeMaterial,
  },
  {
    key: 'bladeStyle',
    label: 'Blade Style',
    getValue: (knife: Knife) => knife.bladeStyle,
  },
  {
    key: 'bladeCoating',
    label: 'Blade Coating / Finish',
    getValue: (knife: Knife) => knife.specs.bladeCoating,
  },
  {
    key: 'hardness',
    label: 'Hardness',
    getValue: (knife: Knife) => knife.specs.hardness,
  },
  {
    key: 'lockingMechanism',
    label: 'Locking Mechanism',
    getValue: (knife: Knife) => knife.specs.lockingMechanism,
  },
  {
    key: 'handleMaterial',
    label: 'Handle Material',
    getValue: (knife: Knife) => knife.handleMaterial,
  },
  {
    key: 'handleLength',
    label: 'Handle Length',
    getValue: (knife: Knife) => knife.specs.handleLength,
  },
  {
    key: 'bladeLength',
    label: 'Blade Length',
    getValue: (knife: Knife) => knife.specs.bladeLength,
  },
  {
    key: 'overallLength',
    label: 'Overall Length',
    getValue: (knife: Knife) => knife.specs.overallLength,
  },
  {
    key: 'bladeThickness',
    label: 'Blade Thickness',
    getValue: (knife: Knife) => knife.specs.bladeThickness,
  },
  {
    key: 'weight',
    label: 'Weight',
    getValue: (knife: Knife) => knife.specs.weight,
  },
  {
    key: 'price',
    label: 'Price',
    getValue: (knife: Knife) => knife.specs.price,
  },
  {
    key: 'country',
    label: 'Country',
    getValue: (knife: Knife) => knife.specs.country,
  },
] as const

type BuiltInFilterKey = (typeof builtInFilterDefinitions)[number]['key']
type CustomFilterKey = `custom:${string}`
type FilterKey = BuiltInFilterKey | CustomFilterKey

function isCustomFilterKey(key: string): key is CustomFilterKey {
  return key.startsWith('custom:')
}

function customFilterKeyToFieldId(key: string): string {
  return key.slice('custom:'.length)
}

function formatCustomFilterValue(value: string, type: CustomFieldType): string {
  if (type !== 'date' || !value) return value
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function sortFilterOptions(options: string[], type: CustomFieldType): string[] {
  if (type === 'number') {
    return [...options].sort((left, right) => {
      const leftNumber = Number.parseFloat(left)
      const rightNumber = Number.parseFloat(right)
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
        return leftNumber - rightNumber
      }
      return left.localeCompare(right)
    })
  }
  return [...options].sort((left, right) => left.localeCompare(right))
}

function CollectionContent() {
  const { knives, pinnedItemsFirst } = useKnives()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const query = searchParams.get('q') ?? ''
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const debouncedQuery = useDebouncedValue(query, 200)

  const replaceParams = useCallback(
    (
      update: (params: URLSearchParams) => void,
      mode: 'router' | 'history' = 'router',
    ) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('sort')
      update(params)
      const nextQuery = params.toString()
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

      if (mode === 'history') {
        window.history.replaceState(null, '', nextUrl)
        return
      }

      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const setQuery = useCallback(
    (value: string) => {
      replaceParams((params) => {
        if (value) {
          params.set('q', value)
        } else {
          params.delete('q')
        }
      })
      setVisibleCount(PAGE_SIZE)
    },
    [replaceParams],
  )

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable

      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (
        event.key === 'Escape' &&
        document.activeElement === searchInputRef.current &&
        query
      ) {
        event.preventDefault()
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [query, setQuery])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' })
        const data = await readJsonResponse<{
          error?: string
          settings?: { customFields?: CustomField[] }
        }>(response)
        if (!cancelled && response.ok && data.settings?.customFields) {
          setCustomFields(data.settings.customFields)
        }
      } catch {
        // ignore
      }
    }

    loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const filterDefinitions = useMemo(
    () => [
      ...builtInFilterDefinitions,
      ...customFields.map((field) => ({
        key: `custom:${field.id}` as CustomFilterKey,
        label: field.name,
        type: field.type,
        getValue: (knife: Knife) => knife.customFields[field.id],
      })),
    ],
    [customFields],
  )

  const selectedFilters = useMemo(
    () =>
      Object.fromEntries(
        filterDefinitions.map((definition) => [
          definition.key,
          searchParams.getAll(definition.key).filter(Boolean),
        ]),
      ) as Record<FilterKey, string[]>,
    [searchParams, filterDefinitions],
  )

  const optionsByFilter = useMemo(
    () =>
      Object.fromEntries(
        filterDefinitions.map((definition) => {
          const field = isCustomFilterKey(definition.key)
            ? customFields.find(
                (item) => item.id === customFilterKeyToFieldId(definition.key),
              )
            : undefined
          const type = field?.type ?? 'text'
          return [
            definition.key,
            sortFilterOptions(
              Array.from(
                new Set(
                  knives
                    .map((knife) => definition.getValue(knife))
                    .filter((value): value is string =>
                      Boolean(value && value.trim().length > 0),
                    ),
                ),
              ),
              type,
            ),
          ]
        }),
      ) as Record<FilterKey, string[]>,
    [knives, filterDefinitions, customFields],
  )

  const filteredKnives = useMemo(() => {
    const matches = knives.filter((knife) => {
      if (!matchesKnifeSearch(knife, debouncedQuery)) return false

      return filterDefinitions.every((definition) => {
        const selectedValues = selectedFilters[definition.key]

        if (selectedValues.length === 0) {
          return true
        }

        const value = definition.getValue(knife)
        return Boolean(value && selectedValues.includes(value))
      })
    })

    return prioritizePinnedKnives(matches, pinnedItemsFirst)
  }, [
    knives,
    debouncedQuery,
    selectedFilters,
    filterDefinitions,
    pinnedItemsFirst,
  ])

  const setFilterValues = (key: FilterKey, values: string[]) => {
    replaceParams((params) => {
      params.delete(key)
      values.forEach((value) => {
        params.append(key, value)
      })
    })
    setVisibleCount(PAGE_SIZE)
  }

  const toggleFilterValue = (key: FilterKey, value: string) => {
    const currentValues = selectedFilters[key]
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((currentValue) => currentValue !== value)
      : [...currentValues, value]

    setFilterValues(key, nextValues)
  }

  const clearAllFilters = () => {
    replaceParams((params) => {
      params.delete('q')
      filterDefinitions.forEach((definition) => params.delete(definition.key))
    })
    setVisibleCount(PAGE_SIZE)
  }

  const activeFilters = filterDefinitions.flatMap((definition) =>
    selectedFilters[definition.key].map((value) => ({
      key: definition.key,
      label: definition.label,
      value: isCustomFilterKey(definition.key)
        ? formatCustomFilterValue(
            value,
            customFields.find(
              (item) => item.id === customFilterKeyToFieldId(definition.key),
            )?.type ?? 'text',
          )
        : value,
      rawValue: value,
    })),
  )

  const hasActiveFilters = activeFilters.length > 0 || query.trim().length > 0

  return (
    <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader title="Collection" />

      {knives.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 border border-[var(--bladevault-line)]/80 bg-[color:var(--bladevault-surface-soft)]/35 p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search names, specs, materials…"
            className="mx-0 max-w-none sm:max-w-sm sm:flex-1"
            inputRef={searchInputRef}
            shortcutHint="/"
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
            <span className="mr-1 text-xs tabular-nums text-muted-foreground">
              {filteredKnives.length === knives.length
                ? `${knives.length} ${knives.length === 1 ? 'knife' : 'knives'}`
                : `${filteredKnives.length} of ${knives.length} knives`}
            </span>
          </div>
        </div>
      )}

      {knives.length > 0 && (
        <div className="mb-6 border border-border/80 bg-muted/20 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Filters
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:gap-2.5 xl:grid-cols-4">
            {filterDefinitions.map((definition) => (
              <FilterMultiSelect
                key={definition.key}
                label={definition.label}
                options={optionsByFilter[definition.key]}
                selectedValues={selectedFilters[definition.key]}
                onToggleValue={(value) =>
                  toggleFilterValue(definition.key, value)
                }
                onSelectAll={() =>
                  setFilterValues(
                    definition.key,
                    optionsByFilter[definition.key],
                  )
                }
                onClear={() => setFilterValues(definition.key, [])}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={`${filter.key}-${filter.rawValue}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <span className="text-muted-foreground">{filter.label}:</span>
              {filter.value}
              <button
                onClick={() =>
                  setFilterValues(
                    filter.key,
                    selectedFilters[filter.key].filter(
                      (value) => value !== filter.rawValue,
                    ),
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
          title={
            hasActiveFilters ? 'No matches found' : 'Your library is empty'
          }
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 [overflow-anchor:none] sm:grid-cols-2 lg:grid-cols-3">
            {filteredKnives.slice(0, visibleCount).map((knife, index) => (
              <KnifeCard key={knife.id} knife={knife} eager={index === 0} />
            ))}
          </div>
          {visibleCount < filteredKnives.length && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + PAGE_SIZE, filteredKnives.length),
                  )
                }
              >
                Load more ({filteredKnives.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <PageHeader
            title="My Library"
            description="Manage and browse your complete knife inventory."
          />
          <div className="h-96 rounded-xl border border-dashed bg-muted/50" />
        </div>
      }
    >
      <CollectionContent />
    </Suspense>
  )
}
