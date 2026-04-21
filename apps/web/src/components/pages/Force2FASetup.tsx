import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { WardenLogo } from '@/components/brand/WardenLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { accountService } from '@/services/auth.service';
import { useTranslation } from 'react-i18next';

interface Force2FASetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function Force2FASetup({ onComplete, onSkip }: Force2FASetupProps) {
  const { t } = useTranslation();
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  useEffect(() => {
    // Setup 2FA on component mount
    const setup2FA = async () => {
      try {
        const setup = await accountService.setup2FA();
        setTwoFactorSetup(setup);
      } catch (error: any) {
        toast.error(t('force2fa.toast.setupFailed'), {
          description: error.response?.data?.message || t('force2fa.toast.setupRetry'),
        });
      } finally {
        setIsLoading(false);
      }
    };

    setup2FA();
  }, [t]);

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationToken || verificationToken.length !== 6) {
      toast.error(t('account.toast.invalidToken'), {
        description: t('account.toast.invalidTokenDesc'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await accountService.enable2FA(verificationToken);
      toast.success(t('account.toast.2faEnabled'), {
        description: t('force2fa.toast.enabledBody'),
      });
      
      // Complete the setup
      onComplete();
    } catch (error: any) {
      toast.error(t('force2fa.toast.verifyFailed'), {
        description: error.response?.data?.message || t('force2fa.toast.verifyDesc'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setShowSkipDialog(true);
  };

  const handleConfirmSkip = () => {
    setShowSkipDialog(false);
    toast.warning(t('force2fa.toast.notEnabled'), {
      description: t('force2fa.toast.skipBody'),
    });
    if (onSkip) {
      onSkip();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">{t('force2fa.loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!twoFactorSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6">
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <AlertDescription className="text-red-800 dark:text-red-200">
                {t('force2fa.setupError')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Security Warning Dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('force2fa.skipDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-foreground">
                {t('force2fa.skipDialog.intro')}
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-200 font-medium">
                  {t('force2fa.skipDialog.risksTitle')}
                </p>
                <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 ml-4 list-disc">
                  <li>{t('force2fa.skipDialog.risk1')}</li>
                  <li>{t('force2fa.skipDialog.risk2')}</li>
                  <li>{t('force2fa.skipDialog.risk3')}</li>
                  <li>{t('force2fa.skipDialog.risk4')}</li>
                </ul>
              </div>
              <p className="text-sm font-medium text-foreground">
                {t('force2fa.skipDialog.confirmQuestion')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('force2fa.skipDialog.goBack')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSkip}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
            >
              {t('force2fa.skipDialog.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <WardenLogo collapsed className="justify-center" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('force2fa.title')}</CardTitle>
          <CardDescription>
            {t('force2fa.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              {t('force2fa.infoAlert')}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{t('force2fa.step1.title')}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {t('force2fa.step1.desc')}
              </p>
              <div className="flex items-center justify-center p-4 bg-white rounded-lg border">
                <img 
                  src={twoFactorSetup.qrCode} 
                  alt={t('force2fa.qrAlt')} 
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center font-mono">
                {t('force2fa.manualEntry', { secret: twoFactorSetup.secret })}
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('force2fa.step2.title')}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {t('force2fa.step2.desc')}
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                {twoFactorSetup.backupCodes.map((code, index) => (
                  <div key={index} className="font-mono text-sm flex items-center justify-between">
                    <span>{code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        toast.success(t('force2fa.toast.codeCopied'));
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('force2fa.copy')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{t('force2fa.step3.title')}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('force2fa.step3.desc')}
                </p>
                <Input
                  placeholder={t('force2fa.placeholder.code')}
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={verificationToken.length !== 6 || isSubmitting}
              >
                {isSubmitting ? t('force2fa.verifying') : t('force2fa.verifyButton')}
              </Button>
            </form>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {t('force2fa.footerNote')}
            </AlertDescription>
          </Alert>

          {onSkip && (
            <div className="pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={handleSkip}
              >
                {t('force2fa.skipButton')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
