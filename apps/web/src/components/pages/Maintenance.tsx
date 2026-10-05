import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Wrench } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

export default function Maintenance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [pollUpdateLog, setPollUpdateLog] = useState(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

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
    const timer = setTimeout(() => setPollUpdateLog(false), UPDATE_LOG_POLL_MAX_MS);
    return () => clearTimeout(timer);
  }, [pollUpdateLog]);

  useEffect(() => {
    const content = updateLogRes?.content;
    if (!pollUpdateLog || !content) return;
    if (content.includes('Update Completed Successfully!')) {
      setPollUpdateLog(false);
    }
  }, [pollUpdateLog, updateLogRes?.content]);

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    });
  }, [updateLogRes?.content, isUpdateLogFetching]);

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

  const packageUpdateMutation = useMutation({
    mutationFn: () => systemConfigService.runPackageUpdate(),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('configuration.systemUpdate.toast.failed'));
        return;
      }
      toast.success(t('configuration.systemUpdate.toast.scheduled'));
      setPollUpdateLog(true);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.systemUpdate.toast.failed'));
    },
  });

  const slaveUpgradeMutation = useMutation({
    mutationFn: () => systemConfigService.upgradeSlaves('product'),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('configuration.systemUpdate.toast.failed'));
        return;
      }
      const failed = res.data?.results.filter((item) => item.status < 200 || item.status >= 300).length ?? 0;
      toast.success(
        failed
          ? `${res.data?.results.length ?? 0} slaves contacted, ${failed} failed`
          : `${res.data?.results.length ?? 0} slaves contacted`,
      );
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.systemUpdate.toast.failed'));
    },
  });

  const runtimes = useQuery({
    queryKey: ['system-config', 'runtimes'],
    queryFn: () => systemConfigService.getRuntimes(),
    enabled: isAdmin,
  });
  const runtimeMutation = useMutation({
    mutationFn: (component: 'node' | 'postgres') => systemConfigService.runRuntimeUpgrade(component),
    onSuccess: (res) => {
      toast.success(res.data?.detail || res.message || t('configuration.runtime.confirm'));
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.systemUpdate.toast.failed'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('maintenance.title')}</h1>
            <p className="text-muted-foreground">{t('maintenance.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={!isAdmin || systemUpdateMutation.isPending}>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={!isAdmin || packageUpdateMutation.isPending}>
                {t('configuration.packageUpdate.button')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('configuration.packageUpdate.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="text-left">{t('configuration.packageUpdate.confirmDesc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('configuration.systemUpdate.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => packageUpdateMutation.mutate()}>{t('configuration.packageUpdate.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={!isAdmin || slaveUpgradeMutation.isPending}>
                {t('configuration.slaveUpgrade.button')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('configuration.slaveUpgrade.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="text-left">{t('configuration.slaveUpgrade.confirmDesc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('configuration.systemUpdate.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => slaveUpgradeMutation.mutate()}>{t('configuration.slaveUpgrade.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
          <CardTitle>{t('configuration.runtime.title')}</CardTitle>
          <CardDescription>{t('configuration.runtime.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runtimes.data?.data?.components.map((row) => (
            <div key={row.id} className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium">{row.id}</div>
              <p className="text-muted-foreground">
                Running {row.current}. New install {row.newInstall}. Latest long-term line {row.latestLts}.
              </p>
              <p className="mt-1 text-muted-foreground">{row.note}</p>
            </div>
          ))}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {(['node', 'postgres'] as const).map((component) => (
                <AlertDialog key={component}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={runtimeMutation.isPending}>
                      {t(component === 'node' ? 'configuration.runtime.node' : 'configuration.runtime.postgres')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('configuration.runtime.confirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription className="text-left">{t('configuration.runtime.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('configuration.systemUpdate.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => runtimeMutation.mutate(component)}>{t('configuration.runtime.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
