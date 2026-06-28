import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-[11px] font-medium uppercase tracking-wide text-[var(--bladevault-title)]">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium tracking-tight text-foreground">{value}</span>
          {trend && (
            <span
              className={`text-[11px] font-medium ${
                trend.positive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {trend.positive !== false ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
