import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed bg-muted/50">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description && (
          <CardDescription className="mt-1 max-w-sm">{description}</CardDescription>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
