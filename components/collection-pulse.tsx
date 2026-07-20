'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ECharts, EChartsOption } from 'echarts'
import Link from 'next/link'
import type { Knife } from '@/lib/data'

const CHART_COLORS = ['#2e3417', '#79824a', '#c89c3d', '#dfc78f', '#eae1cf']

type MakerShare = {
  name: string
  value: number
}

function getDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  })
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short' })
}

function useThemeVersion() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setVersion((current) => current + 1)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return version
}

function useChart(option: EChartsOption) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let chart: ECharts | undefined
    let observer: ResizeObserver | undefined
    let cancelled = false

    void import('echarts').then((echarts) => {
      if (!chartRef.current || cancelled) return

      chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' })
      chart.setOption(option)

      observer = new ResizeObserver(() => {
        chart?.resize()
      })
      observer.observe(chartRef.current)
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      chart?.dispose()
    }
  }, [option])

  return chartRef
}

function getMakerShares(knives: Knife[]): MakerShare[] {
  const counts = new Map<string, number>()

  for (const knife of knives) {
    const brand = knife.brand.trim() || 'Unspecified'
    counts.set(brand, (counts.get(brand) ?? 0) + 1)
  }

  const sorted = [...counts].sort(([, left], [, right]) => right - left)
  const leaders = sorted.slice(0, 4).map(([name, value]) => ({ name, value }))
  const remaining = sorted
    .slice(4)
    .reduce((total, [, value]) => total + value, 0)

  return remaining > 0
    ? [...leaders, { name: 'Other', value: remaining }]
    : leaders
}

function getMonthlyIntake(knives: Knife[], today: Date) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 11 + index, 1)
    return { date, value: 0 }
  })

  for (const knife of knives) {
    const addedAt = getDate(knife.addedAt)
    if (!addedAt) continue

    const monthIndex = months.findIndex(
      ({ date }) =>
        date.getFullYear() === addedAt.getFullYear() &&
        date.getMonth() === addedAt.getMonth(),
    )
    if (monthIndex >= 0) months[monthIndex].value += 1
  }

  return months
}

function getPalette() {
  const style = getComputedStyle(document.documentElement)

  return {
    card: style.getPropertyValue('--card').trim(),
    foreground: style.getPropertyValue('--foreground').trim(),
    muted: style.getPropertyValue('--muted-foreground').trim(),
    ringTrack: document.documentElement.classList.contains('dark')
      ? '#40371f'
      : '#eee6d7',
  }
}

export const CollectionPulse = memo(function CollectionPulse({
  knives,
}: {
  knives: Knife[]
}) {
  useThemeVersion()
  const today = useMemo(() => new Date(), [])
  const palette = getPalette()

  const summary = useMemo(() => {
    const datedKnives = knives
      .map((knife) => ({ knife, date: getDate(knife.addedAt) }))
      .filter((entry): entry is { knife: Knife; date: Date } =>
        Boolean(entry.date),
      )
      .sort((left, right) => right.date.getTime() - left.date.getTime())
    const latest = datedKnives[0]
    const addedThisYear = datedKnives.filter(
      ({ date }) => date.getFullYear() === today.getFullYear(),
    ).length
    const makerShares = getMakerShares(knives)
    const topTwoCount = makerShares
      .slice(0, 2)
      .reduce((total, maker) => total + maker.value, 0)

    return {
      addedThisYear,
      latest,
      makerShares,
      makerCount: new Set(knives.map((knife) => knife.brand.trim())).size,
      monthlyIntake: getMonthlyIntake(knives, today),
      topTwoShare: Math.round((topTwoCount / knives.length) * 100),
    }
  }, [knives, today])

  const totalOption = useMemo<EChartsOption>(
    () => ({
      animation: false,
      series: [
        {
          type: 'gauge',
          silent: true,
          startAngle: 90,
          endAngle: -270,
          center: ['50%', '50%'],
          radius: '86%',
          pointer: { show: false },
          progress: {
            show: true,
            roundCap: true,
            width: 11,
            itemStyle: { color: '#c89c3d' },
          },
          axisLine: {
            lineStyle: { width: 11, color: [[1, palette.ringTrack]] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: {
            show: true,
            offsetCenter: [0, '25%'],
            color: palette.muted,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
          },
          detail: {
            valueAnimation: false,
            offsetCenter: [0, '-10%'],
            color: palette.foreground,
            fontFamily: 'var(--font-sans)',
            fontSize: 38,
            fontWeight: 600,
            formatter: () => String(knives.length),
          },
          data: [{ value: 100, name: `${knives.length} knives` }],
        },
      ],
    }),
    [knives.length, palette],
  )

  const makersOption = useMemo<EChartsOption>(
    () => ({
      animation: false,
      color: CHART_COLORS,
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 7,
        itemHeight: 7,
        itemGap: 10,
        selectedMode: false,
        textStyle: {
          color: palette.muted,
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['49%', '72%'],
          center: ['50%', '43%'],
          avoidLabelOverlap: true,
          silent: true,
          label: {
            show: true,
            position: 'center',
            formatter: `{count|${summary.makerCount}}\n{small|makers}`,
            rich: {
              count: {
                color: palette.foreground,
                fontFamily: 'var(--font-sans)',
                fontSize: 27,
                fontWeight: 600,
                lineHeight: 29,
              },
              small: {
                color: palette.muted,
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
              },
            },
          },
          labelLine: { show: false },
          data: summary.makerShares,
        },
      ],
    }),
    [palette, summary.makerCount, summary.makerShares],
  )

  const rhythmOption = useMemo<EChartsOption>(
    () => ({
      animation: false,
      grid: { left: 0, right: 0, top: 10, bottom: 4 },
      xAxis: {
        type: 'category',
        data: summary.monthlyIntake.map(({ date }) => formatMonth(date)),
        show: false,
      },
      yAxis: {
        type: 'value',
        min: 0,
        show: false,
      },
      series: [
        {
          type: 'line',
          data: summary.monthlyIntake.map(({ value }) => value),
          smooth: 0.35,
          symbol: 'none',
          silent: true,
          lineStyle: { width: 2, color: '#79824a' },
          areaStyle: { color: 'rgba(121, 130, 74, 0.15)' },
        },
      ],
    }),
    [summary.monthlyIntake],
  )

  const totalRef = useChart(totalOption)
  const makersRef = useChart(makersOption)
  const rhythmRef = useChart(rhythmOption)
  const latestName = summary.latest
    ? [summary.latest.knife.brand, summary.latest.knife.name]
        .filter(Boolean)
        .join(' · ')
    : 'No dated entries'

  return (
    <section
      aria-label="Collection summary"
      className="grid overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:grid-cols-[0.95fr_1.2fr_0.95fr]"
    >
      <article className="min-h-72 border-b border-border p-5 lg:border-r lg:border-b-0">
        <h2 className="text-[11px] font-medium tracking-wide text-[var(--bladevault-title)] uppercase">
          Library
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A living count, not just a number.
        </p>
        <div
          ref={totalRef}
          aria-label={`${knives.length} knives catalogued`}
          className="h-48 w-full"
        />
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>
            +{summary.addedThisYear} added in {today.getFullYear()}
          </span>
          <strong className="font-medium text-foreground">
            {knives.length} knives
          </strong>
        </div>
      </article>

      <article className="min-h-72 border-b border-border p-5 lg:border-r lg:border-b-0">
        <h2 className="text-[11px] font-medium tracking-wide text-[var(--bladevault-title)] uppercase">
          Maker mix
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          See at a glance where the collection leans.
        </p>
        <div
          ref={makersRef}
          aria-label={`${summary.makerCount} makers represented`}
          className="h-48 w-full"
        />
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>The top two hold</span>
          <strong className="font-medium text-foreground">
            {summary.topTwoShare}% of collection
          </strong>
        </div>
      </article>

      <article className="min-h-72 p-5">
        <h2 className="text-[11px] font-medium tracking-wide text-[var(--bladevault-title)] uppercase">
          Intake rhythm
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Last twelve months</p>
        <div className="mt-6 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-medium tracking-tight text-foreground">
            {summary.latest ? formatShortDate(summary.latest.date) : '—'}
          </span>
          <span className="text-right text-[10px] font-medium tracking-wide text-[var(--bladevault-title)] uppercase">
            Latest added
          </span>
        </div>
        <div className="mt-4 rounded-lg bg-muted px-3 py-3">
          <span className="block text-[11px] text-muted-foreground">
            Most recent entry
          </span>
          {summary.latest ? (
            <Link
              href={`/collection/${summary.latest.knife.id}`}
              className="mt-1 block truncate text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {latestName}
            </Link>
          ) : (
            <strong className="mt-1 block truncate text-sm font-medium text-foreground">
              {latestName}
            </strong>
          )}
        </div>
        <div
          ref={rhythmRef}
          aria-label="Monthly knife additions over the last twelve months"
          className="mt-3 h-18 w-full"
        />
      </article>
    </section>
  )
})
