import type { Knife } from '@/lib/data';

const SINGLE_LINE_FIELDS = ['name', 'brand', 'bladeStyle', 'handleMaterial'] as const;
const MULTILINE_FIELDS = ['description'] as const;
const TRIM_ONLY_FIELDS = ['sourceUrl'] as const;
const SPEC_FIELDS = [
  'weight',
  'overallLength',
  'bladeLength',
  'bladeThickness',
  'bladeCoating',
  'bladeMaterial',
  'lockingMechanism',
  'designer',
  'modelNumber',
  'handleLength',
  'hardness',
  'country',
] as const;

type KnifeTextShape = Partial<Pick<Knife, typeof SINGLE_LINE_FIELDS[number] | typeof MULTILINE_FIELDS[number] | typeof TRIM_ONLY_FIELDS[number]>> & {
  specs?: Partial<Knife['specs']>;
};

export function normalizeSingleLineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .trim();
}

export function normalizeTrimmedText(value: string): string {
  return value.trim();
}

export function normalizeKnifeTextFields<T extends KnifeTextShape>(value: T): T {
  const normalized = { ...value };

  for (const field of SINGLE_LINE_FIELDS) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = normalizeSingleLineText(normalized[field]) as T[typeof field];
    }
  }

  for (const field of MULTILINE_FIELDS) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = normalizeMultilineText(normalized[field]) as T[typeof field];
    }
  }

  for (const field of TRIM_ONLY_FIELDS) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = normalizeTrimmedText(normalized[field]) as T[typeof field];
    }
  }

  if (normalized.specs) {
    const specs = { ...normalized.specs };
    for (const field of SPEC_FIELDS) {
      if (typeof specs[field] === 'string') {
        specs[field] = normalizeSingleLineText(specs[field]) as Knife['specs'][typeof field];
      }
    }
    normalized.specs = specs as T['specs'];
  }

  return normalized;
}
