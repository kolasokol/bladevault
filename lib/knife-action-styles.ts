import type { CSSProperties } from 'react';

export const activeKnifeActionStyle = {
  background: 'linear-gradient(to bottom, #eaf5d3, #f4f7ed)',
} satisfies CSSProperties;

export const activeKnifeOutlineClassName =
  'border-[#a7c977] text-[#6fac18] hover:text-[#6fac18] dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400';

export const activeKnifeFloatingClassName =
  'border-[#a7c977] text-[#6fac18] hover:bg-[#edf4d9] hover:text-[#6fac18] dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-950/70 dark:hover:text-emerald-400';
