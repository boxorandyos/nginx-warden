import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  identityService,
  type AuthPolicy,
  type AuthProviderConfig,
} from '@/services/identity.service';

function providerTypeLabel(type: string) {
  switch (type) {
    case 'local':
      return 'Local';
    case 'ldap':
      return 'LDAP';
    case 'oidc_entra':
      return 'Entra ID';
    case 'oidc_generic':
      return 'OIDC';
    default:
      return type;
  }
}

export default function Authentication() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [auditOutcome, setAuditOutcome] = useState<string>('');

  const providersQuery = useQuery({
    queryKey: ['identity', 'providers'],
    queryFn: async () => {
      const res = await identityService.listProviders();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const policiesQuery = useQuery({
    queryKey: ['identity', 'policies'],
    queryFn: async () => {
      const res = await identityService.listPolicies();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const abuseSettingsQuery = useQuery({
    queryKey: ['identity', 'abuse-settings'],
    queryFn: async () => {
      const res = await identityService.getAbuseSettings();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const abuseStatesQuery = useQuery({
    queryKey: ['identity', 'abuse-states'],
    queryFn: async () => {
      const res = await identityService.listAbuseStates();
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const auditQuery = useQuery({
    queryKey: ['identity', 'audit', auditOutcome],
    queryFn: async () => {
      const res = await identityService.listAuditLogs({
        page: 1,
        outcome: auditOutcome || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.message || 'Failed');
      return res.data;
    },
    enabled: isAdmin,
  });

  const toggleProvider = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await identityService.updateProvider(id, { enabled });
      if (!res.success) throw new Error(res.message || 'Failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity'] });
      toast.success(t('identity.toast.providerUpdated'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePolicy = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof identityService.updatePolicy>[1];
    }) => {
      const res = await identityService.updatePolicy(id, body);
      if (!res.success) throw new Error(res.message || 'Failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity'] });
      toast.success(t('identity.toast.policyUpdated'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAbuse = useMutation({
    mutationFn: async (body: Record<string, number | boolean | null>) => {
      const res = await identityService.updateAbuseSettings(body as any);
      if (!res.success) throw new Error(res.message || 'Failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'abuse-settings'] });
      toast.success(t('identity.toast.abuseUpdated'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAbuse = useMutation({
    mutationFn: async (key: string) => {
      const res = await identityService.clearAbuseState(key);
      if (!res.success) throw new Error(res.message || 'Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'abuse-states'] });
      queryClient.invalidateQueries({ queryKey: ['identity', 'abuse-settings'] });
      toast.success(t('identity.toast.abuseCleared'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminPortal = useMemo(
    () => policiesQuery.data?.find((p) => p.slug === 'admin_portal'),
    [policiesQuery.data]
  );

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTitle>{t('identity.readOnlyTitle')}</AlertTitle>
        <AlertDescription>{t('identity.readOnlyHint')}</AlertDescription>
      </Alert>
    );
  }

  if (providersQuery.isLoading || policiesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <KeyRound className="h-6 w-6" />
          {t('identity.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('identity.subtitle')}</p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">{t('identity.tabs.providers')}</TabsTrigger>
          <TabsTrigger value="policies">{t('identity.tabs.policies')}</TabsTrigger>
          <TabsTrigger value="abuse">{t('identity.tabs.abuse')}</TabsTrigger>
          <TabsTrigger value="audit">{t('identity.tabs.audit')}</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4 mt-4">
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{t('identity.providers.noticeTitle')}</AlertTitle>
            <AlertDescription>{t('identity.providers.noticeBody')}</AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2">
            {(providersQuery.data || []).map((p: AuthProviderConfig) => {
              const comingSoon = (p.config as any)?.status === 'coming_soon';
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={p.enabled ? 'default' : 'secondary'}>
                        {providerTypeLabel(p.type)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {comingSoon
                        ? t('identity.providers.comingSoon')
                        : p.isSystem
                          ? t('identity.providers.system')
                          : t('identity.providers.optional')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Label htmlFor={`en-${p.id}`}>{t('identity.providers.enabled')}</Label>
                    <Switch
                      id={`en-${p.id}`}
                      checked={p.enabled}
                      disabled={comingSoon || toggleProvider.isPending}
                      onCheckedChange={(enabled) => toggleProvider.mutate({ id: p.id, enabled })}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          {(policiesQuery.data || []).map((policy: AuthPolicy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              providers={providersQuery.data || []}
              saving={savePolicy.isPending}
              onSave={(body) => savePolicy.mutate({ id: policy.id, body })}
              isAdminPortal={policy.slug === 'admin_portal'}
            />
          ))}
          {!adminPortal && (
            <Alert variant="destructive">
              <AlertTitle>{t('identity.policies.missingPortal')}</AlertTitle>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="abuse" className="space-y-4 mt-4">
          {abuseSettingsQuery.data && (
            <AbuseSettingsCard
              settings={abuseSettingsQuery.data}
              saving={saveAbuse.isPending}
              onSave={(body) => saveAbuse.mutate(body)}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t('identity.abuse.activeTitle')}</CardTitle>
              <CardDescription>{t('identity.abuse.activeHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('identity.abuse.colKey')}</TableHead>
                    <TableHead>{t('identity.abuse.colCount')}</TableHead>
                    <TableHead>{t('identity.abuse.colLocked')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(abuseStatesQuery.data || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {t('identity.abuse.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {(abuseStatesQuery.data || []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.key}</TableCell>
                      <TableCell>{s.failureCount}</TableCell>
                      <TableCell>
                        {s.permanentlyBlocked
                          ? t('identity.abuse.permanent')
                          : s.lockedUntil
                            ? new Date(s.lockedUntil).toLocaleString()
                            : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => clearAbuse.mutate(s.key)}
                          disabled={clearAbuse.isPending}
                        >
                          {t('identity.abuse.clear')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <Label>{t('identity.audit.filterOutcome')}</Label>
            <select
              className="border rounded-md h-9 px-2 bg-background"
              value={auditOutcome}
              onChange={(e) => setAuditOutcome(e.target.value)}
            >
              <option value="">{t('identity.audit.all')}</option>
              <option value="success">success</option>
              <option value="failure">failure</option>
              <option value="lockout">lockout</option>
              <option value="blocked">blocked</option>
              <option value="challenge">challenge</option>
            </select>
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('identity.audit.colTime')}</TableHead>
                    <TableHead>{t('identity.audit.colOutcome')}</TableHead>
                    <TableHead>{t('identity.audit.colUser')}</TableHead>
                    <TableHead>{t('identity.audit.colIp')}</TableHead>
                    <TableHead>{t('identity.audit.colMessage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditQuery.data?.items || []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.outcome}</Badge>
                      </TableCell>
                      <TableCell>{row.username || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                      <TableCell className="text-sm">{row.message}</TableCell>
                    </TableRow>
                  ))}
                  {!auditQuery.data?.items?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t('identity.audit.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PolicyCard({
  policy,
  providers,
  saving,
  onSave,
  isAdminPortal,
}: {
  policy: AuthPolicy;
  providers: AuthProviderConfig[];
  saving: boolean;
  onSave: (body: Parameters<typeof identityService.updatePolicy>[1]) => void;
  isAdminPortal: boolean;
}) {
  const { t } = useTranslation();
  const [requireMfa, setRequireMfa] = useState(policy.requireMfa);
  const [groupAllow, setGroupAllow] = useState(policy.groupAllow.join('\n'));
  const [groupDeny, setGroupDeny] = useState(policy.groupDeny.join('\n'));
  const selected = new Set(policy.providers.map((p) => p.providerId));
  const [providerIds, setProviderIds] = useState<string[]>([...selected]);

  const toggleProvider = (id: string) => {
    setProviderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{policy.name}</CardTitle>
        <CardDescription>
          {policy.slug}
          {isAdminPortal ? ` — ${t('identity.policies.portalHint')}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block">{t('identity.policies.allowedIdps')}</Label>
          <div className="flex flex-wrap gap-3">
            {providers
              .filter((p) => p.enabled || selected.has(p.id))
              .map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={providerIds.includes(p.id)}
                    onChange={() => toggleProvider(p.id)}
                    disabled={(p.config as any)?.status === 'coming_soon'}
                  />
                  {p.name}
                </label>
              ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>{t('identity.policies.requireMfa')}</Label>
          <Switch checked={requireMfa} onCheckedChange={setRequireMfa} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`allow-${policy.id}`}>{t('identity.policies.groupAllow')}</Label>
            <textarea
              id={`allow-${policy.id}`}
              className="mt-1 w-full min-h-[80px] border rounded-md p-2 text-sm bg-background"
              value={groupAllow}
              onChange={(e) => setGroupAllow(e.target.value)}
              placeholder={'admins\nops'}
            />
          </div>
          <div>
            <Label htmlFor={`deny-${policy.id}`}>{t('identity.policies.groupDeny')}</Label>
            <textarea
              id={`deny-${policy.id}`}
              className="mt-1 w-full min-h-[80px] border rounded-md p-2 text-sm bg-background"
              value={groupDeny}
              onChange={(e) => setGroupDeny(e.target.value)}
              placeholder={'contractors'}
            />
          </div>
        </div>
        <Button
          disabled={saving}
          onClick={() =>
            onSave({
              requireMfa,
              providerIds,
              groupAllow: groupAllow
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
              groupDeny: groupDeny
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          {t('identity.policies.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

function AbuseSettingsCard({
  settings,
  saving,
  onSave,
}: {
  settings: NonNullable<Awaited<ReturnType<typeof identityService.getAbuseSettings>>['data']>;
  saving: boolean;
  onSave: (body: Record<string, number | boolean | null>) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    maxFailuresPerUser: settings.maxFailuresPerUser,
    userLockMinutes: settings.userLockMinutes,
    maxFailuresPerIp: settings.maxFailuresPerIp,
    ipBanEnabled: settings.ipBanEnabled,
    ipFirewallBanAfter: settings.ipFirewallBanAfter,
    maxFailuresBeforeAuthDisable: settings.maxFailuresBeforeAuthDisable,
    authCircuitMinutes: settings.authCircuitMinutes,
    windowMinutes: settings.windowMinutes,
  });

  const field = (key: keyof typeof form, label: string) => (
    <div key={key}>
      <Label htmlFor={key}>{label}</Label>
      {typeof form[key] === 'boolean' ? (
        <div className="mt-2">
          <Switch
            id={key}
            checked={form[key] as boolean}
            onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
          />
        </div>
      ) : (
        <Input
          id={key}
          type="number"
          className="mt-1"
          value={form[key] as number}
          onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
        />
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('identity.abuse.settingsTitle')}</CardTitle>
        <CardDescription>
          {settings.authDisabledUntil
            ? t('identity.abuse.circuitOpen', {
                until: new Date(settings.authDisabledUntil).toLocaleString(),
              })
            : t('identity.abuse.settingsHint')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          {field('maxFailuresPerUser', t('identity.abuse.maxUser'))}
          {field('userLockMinutes', t('identity.abuse.userLockMin'))}
          {field('maxFailuresPerIp', t('identity.abuse.maxIp'))}
          {field('ipFirewallBanAfter', t('identity.abuse.ipFirewallAfter'))}
          {field('maxFailuresBeforeAuthDisable', t('identity.abuse.circuitAfter'))}
          {field('authCircuitMinutes', t('identity.abuse.circuitMin'))}
          {field('windowMinutes', t('identity.abuse.windowMin'))}
          {field('ipBanEnabled', t('identity.abuse.ipBanEnabled'))}
        </div>
        <Button disabled={saving} onClick={() => onSave(form)}>
          {t('identity.abuse.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
