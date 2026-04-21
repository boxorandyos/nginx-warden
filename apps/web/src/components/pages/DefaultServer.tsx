import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutTemplate, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { defaultServerService } from '@/services/default-server.service';

export default function DefaultServer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [nginxConfig, setNginxConfig] = useState('');
  const [indexHtml, setIndexHtml] = useState('');

  const query = useQuery({
    queryKey: ['default-server'],
    queryFn: async () => {
      const res = await defaultServerService.get();
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to load');
      }
      return res.data;
    },
  });

  useEffect(() => {
    if (query.data) {
      setNginxConfig(query.data.nginxConfig);
      setIndexHtml(query.data.indexHtml);
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: defaultServerService.update,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('defaultServer.toast.saved'));
        queryClient.invalidateQueries({ queryKey: ['default-server'] });
      } else {
        toast.error(res.message || t('defaultServer.toast.saveFailed'));
      }
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(msg || t('defaultServer.toast.saveFailed'));
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ nginxConfig, indexHtml });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <LayoutTemplate className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('defaultServer.title')}</h1>
            <p className="text-muted-foreground">{t('defaultServer.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="ml-2 hidden sm:inline">{t('defaultServer.reload')}</span>
          </Button>
          {isAdmin && (
            <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || query.isLoading}>
              {saveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">{t('defaultServer.save')}</span>
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('defaultServer.readOnlyTitle')}</AlertTitle>
          <AlertDescription>{t('defaultServer.readOnlyHint')}</AlertDescription>
        </Alert>
      )}

      {query.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('defaultServer.loadErrorTitle')}</AlertTitle>
          <AlertDescription>{t('defaultServer.loadErrorHint')}</AlertDescription>
        </Alert>
      )}

      {query.data?.paths && (
        <p className="text-xs text-muted-foreground font-mono">
          {t('defaultServer.pathsOnHost')}: {query.data.paths.nginx} · {query.data.paths.indexHtml}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('defaultServer.nginxBlock')}</CardTitle>
          <CardDescription>{t('defaultServer.nginxBlockDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="nginx-default">{t('defaultServer.nginxLabel')}</Label>
          <Textarea
            id="nginx-default"
            className="min-h-[min(28rem,50vh)] font-mono text-sm"
            value={nginxConfig}
            onChange={(e) => setNginxConfig(e.target.value)}
            readOnly={!isAdmin}
            disabled={query.isLoading}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('defaultServer.indexHtml')}</CardTitle>
          <CardDescription>{t('defaultServer.indexHtmlDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="index-html">{t('defaultServer.indexLabel')}</Label>
          <Textarea
            id="index-html"
            className="min-h-[min(24rem,45vh)] font-mono text-sm"
            value={indexHtml}
            onChange={(e) => setIndexHtml(e.target.value)}
            readOnly={!isAdmin}
            disabled={query.isLoading}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('defaultServer.tipsTitle')}</CardTitle>
          <CardDescription>{t('defaultServer.tipsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('defaultServer.tip1')}</li>
            <li>{t('defaultServer.tip2')}</li>
            <li>{t('defaultServer.tip3')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
