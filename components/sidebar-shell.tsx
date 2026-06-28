'use client';

import dynamic from 'next/dynamic';

export const SidebarShell = dynamic(
  () => import('@/components/sidebar').then((mod) => mod.Sidebar),
  {
    ssr: false,
    loading: () => (
      <aside className="h-screen w-60 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground" />
    ),
  }
);
