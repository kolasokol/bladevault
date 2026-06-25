'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { StorageMode } from '@/lib/settings';
import { BookmarkIcon } from '@/components/bookmark-icon';
import {
  LayoutDashboard,
  Library,
  Scale,
  PlusCircle,
  Settings,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKnives } from '@/components/providers/knives-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import SettingsModal from './settings-modal';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/collection', label: 'Collection', icon: Library },
  { href: '/compare', label: 'Compare', icon: Scale },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { knives } = useKnives();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(true);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (!cancelled && data.settings?.storageMode) {
          setStorageMode(data.settings.storageMode);
        }
      } catch {
        // ignore - keep unknown state
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(
    () => Array.from(new Set(knives.map((knife) => knife.brand))).sort(),
    [knives]
  );

  const pinnedKnives = useMemo(
    () => knives.filter((knife) => knife.pinned),
    [knives]
  );

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <>
      <aside className="flex h-screen w-60 flex-col border-r bg-card">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="relative h-7 w-7 overflow-hidden rounded-lg">
            <Image
              src="/logo.svg"
              alt="BladeVault logo"
              fill
              sizes="28px"
              className="object-contain dark:invert"
              priority
            />
          </div>
          <span className="text-base font-semibold tracking-tight">BladeVault</span>
        </div>

        <div className="px-4 pb-2">
          <div
            className={cn(
              'inline-flex w-fit items-center justify-center rounded-full p-px',
              storageMode === 'remote'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 [background-size:130%] bg-[position:12%_50%]'
                : storageMode === 'local'
                  ? 'bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-600 [background-size:130%] bg-[position:12%_50%]'
                  : 'border border-border bg-transparent p-0'
            )}
          >
            <Badge
              className={cn(
                'h-auto gap-1.25 rounded-full border-0 bg-card px-3 py-[0.22rem] text-[9px] font-semibold uppercase tracking-[0.16em] shadow-none',
                storageMode === 'remote'
                  ? 'text-purple-700 dark:text-purple-300'
                  : storageMode === 'local'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-muted-foreground'
              )}
              title={
                storageMode === 'remote'
                  ? 'Connected to Cloudflare D1 + R2'
                  : storageMode === 'local'
                    ? 'Connected to local SQLite + filesystem'
                    : 'Loading connection state'
              }
            >
              <span
                className={cn(
                  'size-1.25 rounded-full',
                  storageMode === 'remote'
                    ? 'bg-purple-500'
                  : storageMode === 'local'
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/50'
                )}
              />
              {storageMode === 'remote' ? 'Remote' : storageMode === 'local' ? 'Local' : '···'}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <div className="px-2 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Main
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}

          {pinnedKnives.length > 0 && (
            <>
              <Separator className="my-3" />
              <Collapsible open={pinnedOpen} onOpenChange={setPinnedOpen}>
                <CollapsibleTrigger
                  render={
                    <button className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                      Pinned
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 transition-transform',
                          pinnedOpen && 'rotate-90'
                        )}
                      />
                    </button>
                  }
                />
                <CollapsibleContent className="space-y-0.5 pl-1 pt-1">
                  {pinnedKnives.map((knife) => {
                    const knifeHref = `/collection/${knife.id}`;
                    const isKnifeActive = pathname === knifeHref;

                    return (
                      <Link
                        key={knife.id}
                        href={knifeHref}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                          isKnifeActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <BookmarkIcon active className="size-3 shrink-0" />
                        <span className="truncate">
                          <span className="text-muted-foreground">{knife.brand}</span>
                          <span className="mx-1 text-muted-foreground/50">·</span>
                          <span className="font-medium text-foreground">{knife.name}</span>
                        </span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          {brands.length > 0 && (
            <>
              <Separator className="my-3" />
              <Collapsible open={brandsOpen} onOpenChange={setBrandsOpen}>
                <CollapsibleTrigger
                  render={
                    <button className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                      Brands
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 transition-transform',
                          brandsOpen && 'rotate-90'
                        )}
                      />
                    </button>
                  }
                />
                <CollapsibleContent className="space-y-0.5 pl-1 pt-1">
                  {brands.map((brand) => {
                    const brandHref = `/collection?brand=${encodeURIComponent(brand)}`;
                    const isBrandActive =
                      pathname === '/collection' && searchParams.get('brand') === brand;

                    return (
                      <Link
                        key={brand}
                        href={brandHref}
                        className={cn(
                          'flex items-center rounded-md px-2 py-1 text-xs transition-colors',
                          isBrandActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {brand}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          <Card size="sm" className="mt-4">
            <CardHeader>
              <CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-medium tracking-tight">{knives.length}</span>
            </CardContent>
          </Card>
        </nav>

        <div className="flex flex-col gap-2 border-t bg-muted/30 p-3">
          <Button size="sm" className="border border-black bg-white text-black hover:bg-gray-50" render={<Link href="/add" />} nativeButton={false}>
            <PlusCircle className="h-3.5 w-3.5" />
            Add Knife
          </Button>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="sm" className="flex-1" onClick={toggleTheme}>
                    <Sun className="h-3.5 w-3.5 dark:hidden" />
                    <Moon className="hidden h-3.5 w-3.5 dark:block" />
                  </Button>
                }
              />
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
