import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import * as domainService from '@/services/domain.service';

interface InstallationProgressProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: () => void;
}

const STEP_PROGRESS = {
  dependencies: 10,
  modsecurity_download: 20,
  modsecurity_build: 40,
  connector_download: 50,
  nginx_download: 60,
  nginx_build: 75,
  modsecurity_config: 90,
  nginx_config: 95,
  completed: 100,
  error: 0,
} as const;

const INSTALL_STEP_KEYS = new Set<string>(Object.keys(STEP_PROGRESS));

function installStepLabel(step: string, t: (key: string) => string) {
  if (INSTALL_STEP_KEYS.has(step)) {
    return t(`install.step.${step}`);
  }
  return step;
}

export function InstallationProgressDialog({ open, onOpenChange, onComplete }: InstallationProgressProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!open) return;

    const checkStatus = async () => {
      try {
        const installStatus = await domainService.getInstallationStatus();

        if (installStatus) {
          setStatus(installStatus);
          const stepProgress = STEP_PROGRESS[installStatus.step as keyof typeof STEP_PROGRESS] || 0;
          setProgress(stepProgress);

          if (installStatus.status === 'success' || installStatus.step === 'completed') {
            setIsComplete(true);
            if (onComplete) {
              setTimeout(onComplete, 2000);
            }
          }

          if (installStatus.status === 'failed') {
            setHasError(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch installation status:', error);
      }
    };

    checkStatus();

    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [open, onComplete]);

  if (!status) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('install.checkingTitle')}</DialogTitle>
            <DialogDescription>{t('install.checkingDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasError ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t('install.title.failed')}
              </>
            ) : isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('install.title.complete')}
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {t('install.title.progress')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {hasError
              ? t('install.desc.failed')
              : isComplete
                ? t('install.desc.complete')
                : t('install.desc.progress')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{installStepLabel(status.step, t)}</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {status.message && (
            <Alert variant={hasError ? 'destructive' : 'default'}>
              <AlertDescription className="text-sm">{status.message}</AlertDescription>
            </Alert>
          )}

          {!hasError && !isComplete && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• {t('install.bullet1')}</p>
              <p>• {t('install.bullet2')}</p>
              <p>• {t('install.bullet3')}</p>
              <p>• {t('install.bullet4')}</p>
              <p>• {t('install.bullet5')}</p>
            </div>
          )}

          {hasError && (
            <div className="text-sm space-y-2">
              <p className="font-medium">{t('install.errorLogHint')}</p>
              <code className="block bg-muted p-2 rounded text-xs">
                tail -f /var/log/nginx-modsecurity-install.log
              </code>
            </div>
          )}

          {isComplete && (
            <div className="space-y-2">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">{t('install.completeBanner')}</AlertDescription>
              </Alert>
              <div className="text-xs text-muted-foreground">
                <p>
                  {t('install.statusLine', { cmd: 'systemctl status nginx' })}
                </p>
                <p>{t('install.logsLine', { path: '/var/log/nginx/' })}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
