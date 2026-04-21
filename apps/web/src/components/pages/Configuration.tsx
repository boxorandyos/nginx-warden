import { useEffect, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

  useEffect(() => {
    const origins = config?.portalAccessOrigins ?? [];
    setText(origins.join('\n'));
  }, [config?.portalAccessOrigins]);

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
        queryClient.invalidateQueries({ queryKey: ['system-config'] });
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
      if (res.success && res.data?.output) {
        setUpdateOutput(res.data.output);
        toast.success(t('configuration.systemUpdate.toast.success'));
      } else {
        toast.error(res.message || t('configuration.systemUpdate.toast.failed'));
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('configuration.systemUpdate.toast.failed'));
      setUpdateOutput(msg ?? null);
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
          {updateOutput && (
            <div className="space-y-2">
              <Label>{t('configuration.systemUpdate.outputLabel')}</Label>
              <ScrollArea className="h-64 rounded-md border border-border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {updateOutput}
                </pre>
              </ScrollArea>
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
