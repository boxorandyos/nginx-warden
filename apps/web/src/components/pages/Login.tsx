import { useState } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/auth';
import { toast } from 'sonner';
import { Route } from '@/routes/login';
import ForcePasswordChange from './ForcePasswordChange';
import Force2FASetup from './Force2FASetup';
import { WardenLogo } from '@/components/brand/WardenLogo';

type LoginStep = 'login' | 'passwordChange' | '2faSetup' | '2faVerify';

export default function Login() {
  const { t } = useTranslation();
  const highlights = [t('login.hero.highlight1'), t('login.hero.highlight2'), t('login.hero.highlight3')];
  const router = useRouter();
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const { login, loginWith2FA, isLoading: authLoading } = useAuth();
  const navigate = Route.useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoginStep>('login');
  const [userId, setUserId] = useState('');
  const [tempToken, setTempToken] = useState('');

  const search = Route.useSearch();

  const isLoggingIn = isLoading || isSubmitting || authLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (currentStep === '2faVerify' && userId) {
        await loginWith2FA(userId, twoFactor);
        toast.success(t('login.toast.success'));

        await router.invalidate();

        await new Promise((resolve) => setTimeout(resolve, 100));

        await navigate({ to: search.redirect || '/dashboard' });
      } else {
        const response = await login(username, password);

        if (response.requirePasswordChange && response.tempToken) {
          setUserId(response.userId || '');
          setTempToken(response.tempToken);
          setCurrentStep('passwordChange');
          toast.info(t('login.toast.changePassword'));
        } else if (response.requires2FA) {
          setUserId(response.user.id);
          setCurrentStep('2faVerify');
          toast.info(t('login.toast.enter2fa'));
        } else {
          toast.success(t('login.toast.success'));

          await router.invalidate();

          await new Promise((resolve) => setTimeout(resolve, 100));

          await navigate({ to: search.redirect || '/dashboard' });
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || t('errors.loginFailed');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChanged = (require2FASetup: boolean) => {
    if (require2FASetup) {
      setCurrentStep('2faSetup');
      toast.info(t('login.toast.setup2fa'));
    } else {
      setCurrentStep('2faVerify');
      toast.info(t('login.toast.enter2fa'));
    }
  };

  const handle2FASetupComplete = async () => {
    toast.success(t('login.toast.setupComplete'));

    await router.invalidate();

    await new Promise((resolve) => setTimeout(resolve, 500));

    await navigate({ to: search.redirect || '/dashboard' });
  };

  const handle2FASkip = async () => {
    toast.info(t('login.toast.redirecting'));

    await router.invalidate();

    await new Promise((resolve) => setTimeout(resolve, 500));

    await navigate({ to: search.redirect || '/dashboard' });
  };

  if (currentStep === 'passwordChange') {
    return <ForcePasswordChange userId={userId} tempToken={tempToken} onPasswordChanged={handlePasswordChanged} />;
  }

  if (currentStep === '2faSetup') {
    return <Force2FASetup onComplete={handle2FASetupComplete} onSkip={handle2FASkip} />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="relative lg:w-[46%] min-h-[220px] lg:min-h-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-100">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='64' height='64' viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M32 0h1v64H32zM0 32h64v1H0z' fill='%23fff' fill-opacity='0.06'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-500/25 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-primary/35 blur-[110px]" />

        <div className="relative z-10 flex h-full flex-col justify-between gap-10 px-8 py-10 lg:px-12 lg:py-14">
          <div>
            <WardenLogo inverted />
            <h1 className="mt-10 max-w-md font-display text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
              {t('login.hero.title')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300/95">{t('login.hero.subtitle')}</p>
            <ul className="mt-8 space-y-3">
              {highlights.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-slate-200/95">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('login.hero.badge')}</p>
        </div>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12 sm:px-8">
        <Card className="w-full max-w-md border border-border/80 shadow-2xl shadow-primary/5">
          <CardHeader className="space-y-4 text-center lg:text-left lg:pt-2">
            <div className="flex justify-center lg:justify-start lg:hidden">
              <WardenLogo />
            </div>
            <div className="space-y-1">
              <CardTitle className="font-display text-2xl font-bold tracking-tight">
                {currentStep === '2faVerify' ? t('login.twoFactorTitle') : t('login.title')}
              </CardTitle>
              <CardDescription className="text-base">
                {currentStep === '2faVerify' ? t('login.twoFactorDescription') : t('login.cardDescription')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentStep === 'login' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('login.username')}</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      autoComplete="username"
                      className="h-11 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('login.password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 bg-background"
                      required
                    />
                  </div>
                </>
              )}

              {currentStep === '2faVerify' && (
                <div className="space-y-2">
                  <Label htmlFor="twoFactor">{t('login.authCodeLabel')}</Label>
                  <Input
                    id="twoFactor"
                    type="text"
                    inputMode="numeric"
                    value={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="h-14 text-center text-2xl tracking-[0.35em] font-mono bg-background"
                    required
                  />
                  <p className="text-xs text-muted-foreground text-center">{t('login.codesRefresh')}</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full font-semibold shadow-md shadow-primary/15"
                disabled={isLoggingIn || (currentStep === '2faVerify' && twoFactor.length !== 6)}
              >
                {isLoggingIn ? t('login.working') : currentStep === '2faVerify' ? t('login.verifySignIn') : t('login.signin')}
              </Button>

              {currentStep === '2faVerify' && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setCurrentStep('login');
                    setUserId('');
                    setTwoFactor('');
                  }}
                >
                  {t('login.backToLogin')}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
