import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Loader2, Trash2, Eye, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  firewallService,
  type FirewallSetKind,
  type FirewallEntry,
  type FirewallSettings,
  type FirewallState,
  type CrowdsecStatus,
  type NftRuntime,
  type CrowdsecDecisionsPayload,
} from '@/services/firewall.service';

const KIND_OPTIONS: { value: FirewallSetKind; labelKey: string }[] = [
  { value: 'trusted_ipv4', labelKey: 'firewall.kind.trustedIpv4' },
  { value: 'trusted_ipv6', labelKey: 'firewall.kind.trustedIpv6' },
  { value: 'local_deny_ipv4', labelKey: 'firewall.kind.denyIpv4' },
  { value: 'local_deny_ipv6', labelKey: 'firewall.kind.denyIpv6' },
];

export default function Firewall() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<FirewallSetKind>('trusted_ipv4');
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [portsText, setPortsText] = useState('80,443');

  const { data, isLoading, error } = useQuery({
    queryKey: ['firewall', 'state'],
    queryFn: async () => {
      const res = await firewallService.getState();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const crowdsecQuery = useQuery({
    queryKey: ['firewall', 'crowdsec-status'],
    queryFn: async () => {
      const res = await firewallService.getCrowdsecStatus();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const nftRuntimeQuery = useQuery({
    queryKey: ['firewall', 'nft-runtime'],
    queryFn: async () => {
      const res = await firewallService.getNftRuntime();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const decisionsQuery = useQuery({
    queryKey: ['firewall', 'crowdsec-decisions'],
    queryFn: async () => {
      const res = await firewallService.getCrowdsecDecisions();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: false,
  });

  const refetchDiagnostics = () => {
    crowdsecQuery.refetch();
    nftRuntimeQuery.refetch();
  };

  const settings = data?.settings;
  const entries = data?.entries ?? [];
  const applyLogs = data?.applyLogs ?? [];

  useEffect(() => {
    if (settings?.publicTcpPorts?.length) {
      setPortsText(settings.publicTcpPorts.join(','));
    }
  }, [settings?.publicTcpPorts]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => {
      const state = queryClient.getQueryData<FirewallState>(['firewall', 'state']);
      const s = state?.settings;
      if (!s) throw new Error('No settings');
      const parts = portsText
        .split(/[,\s]+/)
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      return firewallService.updateSettings({
        enabled: s.enabled,
        sshPort: s.sshPort,
        apiPort: s.apiPort,
        uiPort: s.uiPort,
        publicTcpPorts: parts.length > 0 ? parts : [80, 443],
        crowdsecNftSetV4: s.crowdsecNftSetV4,
        crowdsecNftSetV6: s.crowdsecNftSetV6,
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('firewall.toast.settingsSaved'));
        queryClient.invalidateQueries({ queryKey: ['firewall', 'state'] });
      } else toast.error(res.message || t('firewall.toast.error'));
    },
    onError: () => toast.error(t('firewall.toast.error')),
  });

  const addEntryMutation = useMutation({
    mutationFn: () => firewallService.addEntry({ kind, cidr, label: label || undefined }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('firewall.toast.entryAdded'));
        setCidr('');
        setLabel('');
        queryClient.invalidateQueries({ queryKey: ['firewall', 'state'] });
      } else toast.error(res.message || t('firewall.toast.error'));
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('firewall.toast.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => firewallService.deleteEntry(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('firewall.toast.entryRemoved'));
        queryClient.invalidateQueries({ queryKey: ['firewall', 'state'] });
      }
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => firewallService.preview(),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setPreviewText(res.data.content);
        toast.success(t('firewall.toast.previewReady'));
      } else toast.error(res.message || t('firewall.toast.error'));
    },
  });

  const applyMutation = useMutation({
    mutationFn: (confirmLockout: boolean) => firewallService.apply(confirmLockout),
    onSuccess: (res) => {
      if (res.success && res.data?.success) {
        toast.success(res.data.message || res.message || t('firewall.toast.applyOk'));
        queryClient.invalidateQueries({ queryKey: ['firewall', 'state'] });
      } else {
        toast.error(res.message || res.data?.error || t('firewall.toast.error'));
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('firewall.toast.error'));
    },
  });

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTitle>{t('firewall.readOnlyTitle')}</AlertTitle>
        <AlertDescription>{t('firewall.readOnlyHint')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('firewall.title')}</h1>
          <p className="text-muted-foreground">{t('firewall.subtitle')}</p>
        </div>
      </div>

      <Alert>
        <AlertTitle>{t('firewall.warningTitle')}</AlertTitle>
        <AlertDescription className="text-sm whitespace-pre-wrap">{t('firewall.warningBody')}</AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{t('firewall.loadError')}</AlertTitle>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('firewall.settingsTitle')}</CardTitle>
          <CardDescription>{t('firewall.settingsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{t('firewall.enabled')}</Label>
                  <p className="text-xs text-muted-foreground">{t('firewall.enabledHint')}</p>
                </div>
                <Switch
                  checked={settings?.enabled ?? false}
                  onCheckedChange={(v) => {
                    queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                      old && 'settings' in old
                        ? { ...old, settings: { ...old.settings, enabled: v } }
                        : old
                    );
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t('firewall.sshPort')}</Label>
                  <Input
                    type="number"
                    value={settings?.sshPort ?? 22}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                        old ? { ...old, settings: { ...old.settings, sshPort: n } } : old
                      );
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('firewall.apiPort')}</Label>
                  <Input
                    type="number"
                    value={settings?.apiPort ?? 3001}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                        old ? { ...old, settings: { ...old.settings, apiPort: n } } : old
                      );
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('firewall.uiPort')}</Label>
                  <Input
                    type="number"
                    value={settings?.uiPort ?? 8080}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                        old ? { ...old, settings: { ...old.settings, uiPort: n } } : old
                      );
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('firewall.publicPorts')}</Label>
                <Input
                  value={portsText}
                  onChange={(e) => setPortsText(e.target.value)}
                  onFocus={() => {
                    if (settings?.publicTcpPorts?.length) {
                      setPortsText(settings.publicTcpPorts.join(','));
                    }
                  }}
                  placeholder="80,443"
                />
                <p className="text-xs text-muted-foreground">{t('firewall.publicPortsHint')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('firewall.crowdsecSetV4')}</Label>
                  <Input
                    value={settings?.crowdsecNftSetV4 ?? ''}
                    onChange={(e) =>
                      queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                        old ? { ...old, settings: { ...old.settings, crowdsecNftSetV4: e.target.value } } : old
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('firewall.crowdsecSetV6')}</Label>
                  <Input
                    value={settings?.crowdsecNftSetV6 ?? ''}
                    onChange={(e) =>
                      queryClient.setQueryData(['firewall', 'state'], (old: typeof data) =>
                        old ? { ...old, settings: { ...old.settings, crowdsecNftSetV6: e.target.value } } : old
                      )
                    }
                  />
                </div>
              </div>
              <Button type="button" onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('firewall.saveSettings')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('firewall.entriesTitle')}</CardTitle>
          <CardDescription>{t('firewall.entriesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label>{t('firewall.kind')}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FirewallSetKind)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('firewall.cidr')}</Label>
              <Input className="w-56 font-mono text-sm" value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="203.0.113.0/24" />
            </div>
            <div className="space-y-2">
              <Label>{t('firewall.label')}</Label>
              <Input className="w-40" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button type="button" onClick={() => addEntryMutation.mutate()} disabled={!cidr.trim() || addEntryMutation.isPending}>
              {t('firewall.addEntry')}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('firewall.kind')}</TableHead>
                <TableHead>{t('firewall.cidr')}</TableHead>
                <TableHead>{t('firewall.label')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: FirewallEntry) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.kind}</TableCell>
                  <TableCell className="font-mono text-sm">{e.cidr}</TableCell>
                  <TableCell>{e.label ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(e.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('firewall.applyTitle')}</CardTitle>
          <CardDescription>{t('firewall.applyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              {t('firewall.preview')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {t('firewall.apply')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('firewall.applyConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription className="text-left">{t('firewall.applyConfirmDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('firewall.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => applyMutation.mutate(false)}>{t('firewall.apply')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="secondary" size="sm">
                  {t('firewall.applyDanger')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('firewall.applyDangerTitle')}</AlertDialogTitle>
                  <AlertDialogDescription className="text-left">{t('firewall.applyDangerDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('firewall.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => applyMutation.mutate(true)}>{t('firewall.applyDangerConfirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {previewText && (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px]">{previewText}</pre>
          )}
          {applyLogs.length > 0 && (
            <div className="space-y-1 text-sm">
              <Label>{t('firewall.lastApplies')}</Label>
              <ul className="list-inside list-disc text-muted-foreground">
                {applyLogs.slice(0, 5).map((log) => (
                  <li key={log.id}>
                    {log.appliedAt} — {log.success ? 'OK' : 'FAIL'}{' '}
                    {log.checksum ? `sha256:${log.checksum.slice(0, 12)}…` : ''}{' '}
                    {log.errorMessage ?? ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{t('firewall.diagnosticsTitle')}</CardTitle>
            <CardDescription>{t('firewall.diagnosticsDesc')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchDiagnostics()}
            disabled={crowdsecQuery.isFetching || nftRuntimeQuery.isFetching}
          >
            {(crowdsecQuery.isFetching || nftRuntimeQuery.isFetching) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t('firewall.refreshDiagnostics')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('firewall.crowdsecTitle')}</Label>
            {crowdsecQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : crowdsecQuery.error ? (
              <p className="text-sm text-destructive">{t('firewall.toast.error')}</p>
            ) : (
              <CrowdsecDiagnosticsBlock data={crowdsecQuery.data} t={t} />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label>{t('firewall.decisionsTitle')}</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => decisionsQuery.refetch()}
                disabled={decisionsQuery.isFetching}
              >
                {decisionsQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('firewall.loadDecisions')}
              </Button>
            </div>
            {decisionsQuery.data && (
              <DecisionsBlock data={decisionsQuery.data} t={t} />
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('firewall.nftRuntimeTitle')}</Label>
            {nftRuntimeQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : nftRuntimeQuery.error ? (
              <p className="text-sm text-destructive">{t('firewall.toast.error')}</p>
            ) : (
              <NftRuntimeBlock data={nftRuntimeQuery.data} t={t} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CrowdsecDiagnosticsBlock({
  data,
  t,
}: {
  data: CrowdsecStatus | undefined;
  t: (k: string) => string;
}) {
  if (!data) return null;
  if (!data.cscliOnPath) {
    return <p className="text-sm text-muted-foreground">{data.hint || t('firewall.cscliMissing')}</p>;
  }
  const parts: string[] = [];
  if (data.version) parts.push(data.version);
  if (data.lapi) {
    parts.push(
      `LAPI ${data.lapi.url}: ${data.lapi.ok ? 'OK' : data.lapi.error || data.lapi.statusCode || 'fail'}`
    );
  }
  if (data.hint) parts.push(data.hint);
  return (
    <div className="space-y-2">
      {parts.length > 0 && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{parts.join('\n')}</p>}
      {data.bouncersList && (
        <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px]">{data.bouncersList}</pre>
      )}
      {data.metricsSnippet && (
        <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px]">{data.metricsSnippet}</pre>
      )}
    </div>
  );
}

function NftRuntimeBlock({ data, t }: { data: NftRuntime | undefined; t: (k: string) => string }) {
  if (!data) return null;
  if (!data.available) {
    return (
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {data.error || t('firewall.nftUnavailable')}
      </p>
    );
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px]">{data.output}</pre>
  );
}

function DecisionsBlock({ data, t }: { data: CrowdsecDecisionsPayload; t: (k: string) => string }) {
  if (!data.ok) {
    return <p className="text-sm text-muted-foreground">{data.error || t('firewall.decisionsError')}</p>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px]">
      {JSON.stringify(data.decisions, null, 2)}
    </pre>
  );
}
