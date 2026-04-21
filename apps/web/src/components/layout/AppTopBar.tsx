import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { appNavSections } from './nav-config';
import { AppUserMenu } from './AppUserMenu';
import { WardenLogo } from '@/components/brand/WardenLogo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ComponentType } from 'react';

function SectionDropdown({
  sectionKey,
  items,
}: {
  sectionKey: string;
  items: { path: string; navKey: string; icon: ComponentType<{ className?: string }> }[];
}) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const isActive = items.some((item) => matchRoute({ to: item.path, fuzzy: true }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-10 rounded-none border px-3 text-xs font-semibold uppercase tracking-[0.18em]',
            isActive
              ? 'border-foreground/20 bg-foreground/[0.06] text-foreground'
              : 'border-transparent text-muted-foreground hover:border-foreground/10 hover:bg-muted/40 hover:text-foreground'
          )}
        >
          {t(sectionKey)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem] rounded-none border-foreground/10 p-0">
        <div className="border-b border-border px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t(sectionKey)}</span>
        </div>
        <div className="p-1">
          {items.map((item) => {
            const active = matchRoute({ to: item.path, fuzzy: true });
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.path} asChild className="rounded-none p-0">
                <Link
                  to={item.path}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-sm outline-none',
                    active && 'bg-foreground/[0.07] font-medium'
                  )}
                >
                  <Icon className="h-4 w-4 opacity-70" />
                  {t(item.navKey)}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopBar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pulseActive = matchRoute({ to: '/dashboard', fuzzy: true });

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
      <div className="flex w-full items-center gap-3 px-3 md:px-5">
        <div className="flex items-center gap-2 md:gap-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden rounded-none" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)] rounded-none border-r-foreground/10 p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <WardenLogo />
              </SheetHeader>
              <nav className="flex flex-col gap-0 p-2">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'border border-transparent px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em]',
                    pulseActive && 'border-foreground/15 bg-foreground/[0.06]'
                  )}
                >
                  {t('nav.section.pulse')}
                </Link>
                {appNavSections
                  .filter((s): s is Extract<typeof s, { kind: 'menu' }> => s.kind === 'menu')
                  .map((section) => (
                    <div key={section.id} className="border-t border-border pt-2">
                      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {t(section.sectionKey)}
                      </p>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = matchRoute({ to: item.path, fuzzy: true });
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-2 border border-transparent px-3 py-2.5 text-sm',
                              active && 'border-foreground/15 bg-foreground/[0.06]'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0 opacity-80" />
                            {t(item.navKey)}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="shrink-0 outline-none ring-offset-background focus-visible:ring-2 ring-foreground/20">
            <WardenLogo />
          </Link>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {appNavSections.map((section) => {
            if (section.kind === 'link') {
              const active = matchRoute({ to: section.path, fuzzy: true });
              return (
                <Link key={section.id} to={section.path}>
                  <span
                    className={cn(
                      'inline-flex h-10 items-center border px-3 text-xs font-semibold uppercase tracking-[0.18em]',
                      active
                        ? 'border-foreground/20 bg-foreground/[0.06] text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-foreground/10 hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    {t(section.navKey)}
                  </span>
                </Link>
              );
            }
            return <SectionDropdown key={section.id} sectionKey={section.sectionKey} items={section.items} />;
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center">
          <AppUserMenu />
        </div>
      </div>
    </header>
  );
}
