'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--bladevault-line)] bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-4 py-2.5">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description ? (
            <div className="text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export function Row({
  label,
  description,
  children,
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        'border-b border-[var(--bladevault-line)]/60 last:border-b-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function MonoValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="break-all rounded-md border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </div>
  )
}

export function PrototypeNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)]/45 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  )
}

export function BetaBadge() {
  return (
    <span className="flex h-4 shrink-0 items-center rounded-full border border-[var(--bladevault-line)] bg-[var(--bladevault-surface-soft)] px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--bladevault-olive)] dark:border-[var(--bladevault-gold)] dark:bg-[var(--bladevault-gold)] dark:text-[var(--bladevault-olive)]">
      Beta
    </span>
  )
}
