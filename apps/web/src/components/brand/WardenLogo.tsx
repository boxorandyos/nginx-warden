import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Brand mark from `public/icon-pack` (served at `/icon-pack/...`). */
const FLAT_LOGO_SRC = '/icon-pack/nginx-warden-master-transparent.png';

type WardenLogoProps = {
  collapsed?: boolean;
  /** Light text for use on dark backgrounds (e.g. login hero) */
  inverted?: boolean;
  /**
   * `flat` (default) — PNG mark. Use everywhere the product should read as “Nginx Warden”.
   * `default` — legacy gradient tile + Lucide shield (rare; not for primary branding).
   */
  variant?: 'default' | 'flat';
  className?: string;
};

export function WardenLogo({ collapsed, inverted, variant = 'flat', className }: WardenLogoProps) {
  const isFlat = variant === 'flat';

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden',
          isFlat
            ? cn(
                'h-9 w-9 rounded-none p-0.5',
                inverted
                  ? 'border border-white/25 bg-white/10 shadow-sm shadow-black/20'
                  : 'border border-foreground/15 bg-background dark:border-foreground/25'
              )
            : cn(
                'rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80',
                'shadow-md shadow-primary/25 ring-1 ring-primary/20 dark:ring-primary/30',
                collapsed ? 'h-9 w-9' : 'h-10 w-10'
              )
        )}
      >
        {isFlat ? (
          <img
            src={FLAT_LOGO_SRC}
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-contain object-center"
            aria-hidden
            decoding="async"
          />
        ) : (
          <Shield
            className={cn(
              'h-5 w-5 text-primary-foreground drop-shadow-sm',
              collapsed && 'h-[18px] w-[18px]'
            )}
            strokeWidth={2.25}
          />
        )}
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-none gap-0.5">
          <span
            className={cn(
              'text-[0.65rem] font-semibold uppercase tracking-[0.22em]',
              inverted ? 'text-slate-400' : 'text-muted-foreground'
            )}
          >
            Nginx
          </span>
          <span
            className={cn(
              'font-display text-lg font-bold tracking-tight',
              inverted ? 'text-white' : 'text-foreground'
            )}
          >
            Warden
          </span>
        </div>
      )}
    </div>
  );
}
