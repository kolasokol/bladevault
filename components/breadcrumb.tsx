'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type BreadcrumbProps = {
  items: { label: string; href?: string }[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <ShadcnBreadcrumb className="mb-4">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" className="flex items-center gap-1" />}>
            <Home className="h-3 w-3" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.length > 0 && <BreadcrumbSeparator className="[&>svg]:size-3" />}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={item.label}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="text-xs">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} className="text-xs" />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="[&>svg]:size-3" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </ShadcnBreadcrumb>
  );
}
