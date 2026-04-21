import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Languages,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth';
import { getUserAvatarInitials } from '@/lib/user-avatar';
import { cn } from '@/lib/utils';
import { SUPPORTED_LOCALES } from '@/locales';

export function AppUserMenu({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { setTheme } = useTheme();
  const { user: currentUser, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    await router.invalidate();
    router.navigate({ to: '/login' });
  };

  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'h-10 gap-2 rounded-none px-2 font-normal',
              'border border-transparent hover:border-foreground/15 hover:bg-muted/50'
            )}
          >
            <Avatar className="h-8 w-8 rounded-none border border-foreground/10">
              <AvatarImage src={currentUser?.avatar ?? undefined} alt="" />
              <AvatarFallback className="rounded-none bg-muted text-xs font-semibold">
                {getUserAvatarInitials(currentUser)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate text-left text-sm font-medium sm:inline">
              {currentUser?.username ?? '—'}
            </span>
            <ChevronRight className="hidden h-4 w-4 rotate-90 opacity-50 sm:inline" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-none border-foreground/10 p-0">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('nav.user.session')}</p>
            <p className="truncate text-sm font-semibold">{currentUser?.username ?? '—'}</p>
          </div>
          <div className="p-1">
            <DropdownMenuItem asChild className="rounded-none">
              <Link to="/account" className="flex cursor-pointer items-center gap-2">
                <Settings className="h-4 w-4" />
                {t('nav.user.account')}
              </Link>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-none">
              <Sun className="mr-2 h-4 w-4" />
              {t('nav.user.theme')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rounded-none">
              <DropdownMenuItem className="rounded-none" onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                {t('nav.user.themeLight')}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-none" onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                {t('nav.user.themeDark')}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-none" onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                {t('nav.user.themeSystem')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-none">
              <Languages className="mr-2 h-4 w-4" />
              {t('nav.user.language')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rounded-none">
              {SUPPORTED_LOCALES.map((loc) => {
                const active = i18n.resolvedLanguage === loc.code;
                return (
                  <DropdownMenuItem
                    key={loc.code}
                    className="rounded-none"
                    onClick={() => i18n.changeLanguage(loc.code)}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1">{loc.nativeLabel}</span>
                      {active ? <Check className="h-4 w-4 shrink-0 opacity-70" aria-hidden /> : null}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="bg-border" />
          <div className="p-1">
            <DropdownMenuItem className="rounded-none text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.user.logout')}
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
