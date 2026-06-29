'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArchiveX, FileDown, ImageIcon, Printer, X } from 'lucide-react';
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
type CompareRowKey = (typeof compareRows)[number]['key'];

function getRowValue(knife: Knife, rowKey: CompareRowKey): string {
  if (rowKey.includes('.')) {
    const specKey = rowKey.split('.')[1] as keyof Knife['specs'];
    return knife.specs[specKey] ?? '-';
  }

  const knifeKey = rowKey as 'bladeStyle' | 'handleMaterial';
  return knife[knifeKey] ?? '-';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function ComparePage() {
  const { knives, compareIds, addToCompare, removeFromCompare, clearCompare } = useKnives();
  const [hoveredCell, setHoveredCell] = useState<{
    knifeId: string;
    rowKey: (typeof compareRows)[number]['key'];
  } | null>(null);

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

  const handleClearCompare = () => {
    void clearCompare();
  };

  const hasComparedKnives = comparedKnives.length > 0;
  const showAddSlot = compareIds.length < COMPARE_LIMIT;
  const slotCount = compareIds.length + (showAddSlot ? 1 : 0);

  const handleExportPdf = async () => {
    if (!hasComparedKnives) return;

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const title = 'BladeVault Comparison Table';
    const head = [['Feature', ...comparedKnives.map((knife) => `${knife.brand} ${knife.name}`)]];
    const body = compareRows.map((row) => [
      row.label,
      ...comparedKnives.map((knife) => getRowValue(knife, row.key)),
    ]);

    autoTable(doc, {
      startY: 18,
      head,
      body,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          cellWidth: 46,
        },
      },
      didDrawPage: () => {
        doc.setFontSize(12);
        doc.text(title, 14, 12);
      },
    });

    doc.save(`bladevault-comparison-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => {
    if (!hasComparedKnives) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
    if (!printWindow) return;

    const generatedAt = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    const headerCells = comparedKnives
      .map((knife) => `<th>${escapeHtml(`${knife.brand} ${knife.name}`)}</th>`)
      .join('');

    const bodyRows = compareRows
      .map((row) => {
        const cells = comparedKnives
          .map((knife) => `<td>${escapeHtml(getRowValue(knife, row.key))}</td>`)
          .join('');
        return `<tr><th>${escapeHtml(row.label)}</th>${cells}</tr>`;
      })
      .join('');

    const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BladeVault Comparison</title>
  <style>
    body {
      margin: 24px;
      color: #111827;
      font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 24px;
    }
    p {
      margin: 0 0 18px;
      color: #4b5563;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 12px;
    }
    thead th {
      background: #111827;
      color: #ffffff;
      text-align: left;
      border: 1px solid #d1d5db;
      padding: 8px;
      word-wrap: break-word;
    }
    tbody th {
      background: #f3f4f6;
      text-align: left;
      font-weight: 600;
    }
    td, tbody th {
      border: 1px solid #d1d5db;
      padding: 7px 8px;
      word-wrap: break-word;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td {
      background: #f9fafb;
    }
    @media print {
      body {
        margin: 12mm;
      }
    }
  </style>
</head>
<body>
  <h1>BladeVault Comparison</h1>
  <p>Generated ${escapeHtml(generatedAt)}</p>
  <table>
    <thead>
      <tr>
        <th>Feature</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</body>
</html>`;

    printWindow.document.write(printableHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

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
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCompare}
              disabled={!hasComparedKnives}
            >
              <ArchiveX className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleExportPdf();
              }}
              disabled={!hasComparedKnives}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!hasComparedKnives}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>

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
                    <TableRow className="bg-white hover:bg-white">
                      <TableHead className="sticky left-0 z-10 w-40 bg-white text-[10px] uppercase tracking-wider text-[var(--bladevault-title)] shadow-[2px_0_0_0_var(--border),6px_0_8px_-4px_rgba(0,0,0,0.12)]">Feature</TableHead>
                      {comparedKnives.map((knife) => (
                        <TableHead
                          key={knife.id}
                          className={cn(
                            'min-w-[180px] bg-white transition-colors',
                            hoveredCell?.knifeId === knife.id && 'bg-muted/60'
                          )}
                        >
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
                            'sticky left-0 z-10 text-[11px] font-medium uppercase tracking-wider text-[var(--bladevault-title)] shadow-[2px_0_0_0_var(--border),6px_0_8px_-4px_rgba(0,0,0,0.12)] transition-colors',
                            idx % 2 === 0
                              ? 'bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))]'
                              : 'bg-card',
                            hoveredCell?.rowKey === row.key && 'bg-muted'
                          )}
                        >
                          {row.label}
                        </TableCell>
                        {comparedKnives.map((knife) => {
                          const value = getRowValue(knife, row.key);
                          return (
                            <TableCell
                              key={knife.id}
                              className={cn(
                                'text-sm text-foreground transition-colors',
                                hoveredCell?.knifeId === knife.id &&
                                  hoveredCell?.rowKey === row.key &&
                                  'bg-muted'
                              )}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  knifeId: knife.id,
                                  rowKey: row.key,
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                            >
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
