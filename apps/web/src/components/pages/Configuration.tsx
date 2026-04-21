import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Loader2, RotateCw, Download } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { systemConfigService } from '@/services/system-config.service';
import { systemConfigQueryOptions } from '@/queries/system-config.query-options';

export default function Configuration() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(systemConfigQueryOptions.all);
  const config = data?.data;

  const [text, setText] = useState('');
  /** Poll server log after scheduling an update until completion or timeout */
  const [pollUpdateLog, setPollUpdateLog] = useState(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const origins = config?.portalAccessOrigins ?? [];
    setText(origins.join('\n'));
  }, [config?.portalAccessOrigins]);

  /** Poll log on an interval while this page is open (admin) so the tail updates without clicking Refresh */
  const UPDATE_LOG_INTERVAL_MS = 1000;
  const UPDATE_LOG_POLL_MAX_MS = 45 * 60 * 1000;

  const {
    data: updateLogRes,
    isPending: isUpdateLogPending,
    isFetching: isUpdateLogFetching,
    isError: isUpdateLogError,
    refetch: refetchUpdateLog,
  } = useQuery({
    queryKey: ['system-config', 'system-update-log'],
    queryFn: async () => {
      const res = await systemConfigService.getSystemUpdateLog();
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to load update log');
      }
      return res.data;
    },
    enabled: isAdmin,
    staleTime: 0,
    refetchInterval: isAdmin ? UPDATE_LOG_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    retry: false,
  });

  useEffect(() => {
    if (!pollUpdateLog) return;
    const t = setTimeout(() => setPollUpdateLog(false), UPDATE_LOG_POLL_MAX_MS);
    return () => clearTimeout(t);
  }, [pollUpdateLog]);

  useEffect(() => {
    const content = updateLogRes?.content;
    if (!pollUpdateLog || !content) return;
    if (content.includes('Update Completed Successfully!')) {
      setPollUpdateLog(false);
    }
  }, [pollUpdateLog, updateLogRes?.content]);

  /** Keep the log view pinned to the latest lines (tail) as content updates */
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, [updateLogRes?.content, isUpdateLogFetching]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lines = text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return systemConfigService.updatePortalAccess(lines);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('configuration.toast.saved'));
        queryClient.invalidateQueries({ queryKey: ['system-config'], exact: true });
      } else {
        toast.error(res.message || t('configuration.toast.saveFailed'));
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.toast.saveFailed'));
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const systemUpdateMutation = useMutation({
    mutationFn: () => systemConfigService.runSystemUpdate(),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('configuration.systemUpdate.toast.failed'));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['system-config', 'system-update-log'] });
      if (res.data?.output) {
        toast.success(
          res.data.scheduled
            ? t('configuration.systemUpdate.toast.scheduled')
            : t('configuration.systemUpdate.toast.success')
        );
      }
      if (res.data?.scheduled) {
        setPollUpdateLog(true);
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.systemUpdate.toast.failed'));
    },
  });

  const restartMutation = useMutation({
    mutationFn: () => systemConfigService.restartFrontend(),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('configuration.toast.restartSuccess'));
      } else {
        toast.error(res.message || t('configuration.toast.restartFailed'));
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.toast.restartFailed'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('configuration.title')}</h1>
            <p className="text-muted-foreground">{t('configuration.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !isAdmin ||
                  systemUpdateMutation.isPending ||
                  restartMutation.isPending ||
                  saveMutation.isPending
                }
              >
                {systemUpdateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {t('configuration.systemUpdate.button')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('configuration.systemUpdate.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="text-left">
                  {t('configuration.systemUpdate.confirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('configuration.systemUpdate.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => systemUpdateMutation.mutate()}
                  disabled={systemUpdateMutation.isPending}
                >
                  {t('configuration.systemUpdate.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            type="button"
            variant="outline"
            onClick={() => restartMutation.mutate()}
            disabled={!isAdmin || restartMutation.isPending || saveMutation.isPending || systemUpdateMutation.isPending}
          >
            {restartMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="mr-2 h-4 w-4" />
            )}
            {t('configuration.restartFrontend')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isAdmin || saveMutation.isPending || isLoading || restartMutation.isPending || systemUpdateMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('configuration.save')}
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <Alert>
          <AlertTitle>{t('configuration.readOnlyTitle')}</AlertTitle>
          <AlertDescription>{t('configuration.readOnlyHint')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('configuration.systemUpdate.title')}</CardTitle>
          <CardDescription>{t('configuration.systemUpdate.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertTitle>{t('configuration.systemUpdate.warningTitle')}</AlertTitle>
            <AlertDescription className="text-sm">{t('configuration.systemUpdate.warningHint')}</AlertDescription>
          </Alert>
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t('configuration.systemUpdate.outputLabel')}</Label>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {pollUpdateLog ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t('configuration.systemUpdate.logPolling')}
                      </>
                    ) : (
                      t('configuration.systemUpdate.logLive')
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => refetchUpdateLog()}
                  >
                    {t('configuration.systemUpdate.logRefresh')}
                  </Button>
                </div>
              </div>
              {isUpdateLogError && !updateLogRes && (
                <p className="text-sm text-muted-foreground">{t('configuration.systemUpdate.logUnavailable')}</p>
              )}
              {updateLogRes?.truncated && (
                <p className="text-xs text-muted-foreground">{t('configuration.systemUpdate.logTruncated')}</p>
              )}
              <div
                ref={logScrollRef}
                className="h-64 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-muted/30 p-3"
              >
                <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {(() => {
                    if (isUpdateLogPending && !updateLogRes) {
                      return t('configuration.systemUpdate.logLoading');
                    }
                    if (updateLogRes?.content && updateLogRes.content.length > 0) {
                      return updateLogRes.content;
                    }
                    if (updateLogRes && !updateLogRes.exists) {
                      return t('configuration.systemUpdate.logEmpty');
                    }
                    if (updateLogRes?.exists && updateLogRes.content === '') {
                      return t('configuration.systemUpdate.logFileEmpty');
                    }
                    return '';
                  })()}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configuration.portalAccess.title')}</CardTitle>
          <CardDescription>{t('configuration.portalAccess.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="portal-origins">{t('configuration.portalAccess.label')}</Label>
            <Textarea
              id="portal-origins"
              rows={8}
              className="font-mono text-sm"
              placeholder={t('configuration.portalAccess.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!isAdmin || isLoading}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t('configuration.portalAccess.help')}</p>
          <Alert>
            <AlertTitle>{t('configuration.portalAccess.restartTitle')}</AlertTitle>
            <AlertDescription className="text-sm">{t('configuration.portalAccess.restartHint')}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
