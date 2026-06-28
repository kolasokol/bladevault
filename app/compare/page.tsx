'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArchiveX, ImageIcon, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { getImageUrl, Knife } from '@/lib/data';
import { useKnives } from '@/components/providers/knives-provider';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const compareRows = [
  { label: 'Model Number', key: 'specs.modelNumber' },
  { label: 'Blade Material', key: 'specs.bladeMaterial' },
  { label: 'Blade Style', key: 'bladeStyle' },
  { label: 'Blade Coating / Finish', key: 'specs.bladeCoating' },
  { label: 'Hardness', key: 'specs.hardness' },
  { label: 'Locking Mechanism', key: 'specs.lockingMechanism' },
  { label: 'Handle Material', key: 'handleMaterial' },
  { label: 'Handle Length', key: 'specs.handleLength' },
  { label: 'Blade Length', key: 'specs.bladeLength' },
  { label: 'Overall Length', key: 'specs.overallLength' },
  { label: 'Blade Thickness', key: 'specs.bladeThickness' },
  { label: 'Weight', key: 'specs.weight' },
  { label: 'Country', key: 'specs.country' },
] as const;

const COMPARE_LIMIT = 12;

export default function ComparePage() {
  const { knives, compareIds, addToCompare, removeFromCompare } = useKnives();

  const comparedKnives = compareIds
    .map((id) => knives.find((k) => k.id === id))
    .filter((k): k is Knife => Boolean(k));

  const handleSelect = (slotIndex: number, id: string) => {
    if (!id) return;
    if (compareIds.includes(id)) return;
    if (compareIds.length >= COMPARE_LIMIT) return;
    addToCompare(id);
  };

  const handleRemove = (id: string) => {
    removeFromCompare(id);
  };

  const showAddSlot = compareIds.length < COMPARE_LIMIT;
  const slotCount = compareIds.length + (showAddSlot ? 1 : 0);

  return (
    <div className="flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader
        title="Comparison Check"
        description="Select up to 12 knives to compare specifications side-by-side."
      />

      {knives.length === 0 ? (
        <EmptyState
          title="Nothing to compare"
          description="Add at least one knife to use the comparison tool."
          icon={<ArchiveX className="h-8 w-8" />}
        />
      ) : (
        <>
          <div className="mb-6 overflow-x-auto">
            <div className="flex min-w-max items-center">
              {comparedKnives.map((knife, index) => (
                <div key={knife.id} className="flex items-center">
                  {index > 0 && (
                    <div className="mx-3 h-4 w-px bg-border" />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(knife.id)}
                      className="text-[var(--bladevault-local)] transition-colors hover:text-destructive"
                      aria-label="Remove from compare"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--bladevault-title)]">
                      {knife.brand} {knife.name}
                    </span>
                  </div>
                </div>
              ))}
              {showAddSlot && (
                <div className="flex items-center">
                  {comparedKnives.length > 0 && (
                    <div className="mx-3 h-4 w-px bg-border" />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--bladevault-title)]">
                      Add knife
                    </span>
                    <Select
                      value=""
                      onValueChange={(value) => handleSelect(slotCount - 1, value ?? '')}
                    >
                      <SelectTrigger className="w-48" size="sm">
                        <SelectValue placeholder="Select a knife" />
                      </SelectTrigger>
                      <SelectContent>
                        {knives
                          .filter((k) => !compareIds.includes(k.id))
                          .sort((a, b) => a.brand.localeCompare(b.brand))
                          .map((knife) => (
                            <SelectItem key={knife.id} value={knife.id}>
                              {knife.brand} {knife.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {comparedKnives.length === 0 ? (
            <EmptyState
              title="Select knives to compare"
              description="Choose one or more knives from the selector above or add them from your collection."
              icon={<ArchiveX className="h-8 w-8" />}
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-10 w-40 bg-card text-[10px] uppercase tracking-wider text-[var(--bladevault-title)] shadow-[2px_0_0_0_var(--border),6px_0_8px_-4px_rgba(0,0,0,0.12)]">Feature</TableHead>
                      {comparedKnives.map((knife) => (
                        <TableHead key={knife.id} className="min-w-[180px]">
                          <div className="group/image relative mb-2 aspect-video w-full overflow-hidden rounded-lg cursor-pointer">
                            {knife.images.length > 0 ? (
                              <Image
                                src={getImageUrl(knife.images[0])}
                                alt={knife.name}
                                fill
                                className="object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted/50">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                            <button
                              onClick={() => handleRemove(knife.id)}
                              className="absolute right-1.5 top-1.5 z-10 text-red-500 opacity-0 transition-opacity group-hover/image:opacity-100 hover:text-red-600"
                              aria-label="Remove from compare"
                              title="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <Link
                            href={`/collection/${knife.id}`}
                            className="block hover:underline"
                          >
                            <div className="text-sm font-medium">{knife.name}</div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--bladevault-title)]">
                              {knife.brand}
                            </div>
                          </Link>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareRows.map((row, idx) => (
                      <TableRow
                        key={row.label}
                        className={cn(idx % 2 === 0 && 'bg-muted/30')}
                      >
                        <TableCell
                          className={cn(
                            'sticky left-0 z-10 text-[11px] font-medium uppercase tracking-wider text-[var(--bladevault-title)] shadow-[2px_0_0_0_var(--border),6px_0_8px_-4px_rgba(0,0,0,0.12)]',
                            idx % 2 === 0
                              ? 'bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))]'
                              : 'bg-card'
                          )}
                        >
                          {row.label}
                        </TableCell>
                        {comparedKnives.map((knife) => {
                          const value = row.key.includes('.')
                            ? (knife.specs as Record<string, string>)[row.key.split('.')[1]]
                            : ((knife as unknown) as Record<string, string>)[row.key];
                          return (
                            <TableCell key={knife.id} className="text-sm text-foreground">
                              {value ?? '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
