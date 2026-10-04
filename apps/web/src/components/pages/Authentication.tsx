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
import { getDomains } from '@/services/domain.service';

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

function isConfigured(p: AuthProviderConfig): boolean {
  const c = (p.config || {}) as Record<string, unknown>;
  if (p.type === 'local') return true;
  if (p.type === 'ldap') return Boolean(c.url && c.searchBase);
  if (p.type === 'oidc_entra') return Boolean((c.issuer || c.entraTenantId) && c.clientId);
  if (p.type === 'oidc_generic') return Boolean(c.issuer && c.clientId);
  return false;
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

  const domainsQuery = useQuery({
    queryKey: ['identity', 'domains-for-gateway'],
    queryFn: async () => {
      const res = await getDomains({ limit: 200, sortBy: 'name', sortOrder: 'asc' });
      return res.data || [];
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

  const saveProviderConfig = useMutation({
    mutationFn: async ({
      id,
      config,
      name,
    }: {
      id: string;
      config: Record<string, unknown>;
      name?: string;
    }) => {
      const res = await identityService.updateProvider(id, { config, name });
      if (!res.success) throw new Error(res.message || 'Failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity'] });
      toast.success(t('identity.toast.configSaved'));
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

  const createGateway = useMutation({
    mutationFn: async (body: Parameters<typeof identityService.createGatewayPolicy>[0]) => {
      const res = await identityService.createGatewayPolicy(body);
      if (!res.success) throw new Error(res.message || 'Failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity'] });
      toast.success(t('identity.toast.gatewayCreated'));
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

  const domainsWithGateway = useMemo(() => {
    const set = new Set(
      (policiesQuery.data || [])
        .filter((p) => p.target === 'access_gateway' && p.domainId)
        .map((p) => p.domainId as string)
    );
    return set;
  }, [policiesQuery.data]);

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
          <div className="grid gap-4 lg:grid-cols-2">
            {(providersQuery.data || []).map((p: AuthProviderConfig) => (
              <ProviderCard
                key={`${p.id}-${p.updatedAt}`}
                provider={p}
                toggling={toggleProvider.isPending}
                saving={saveProviderConfig.isPending}
                onToggle={(enabled) => toggleProvider.mutate({ id: p.id, enabled })}
                onSaveConfig={(config) =>
                  saveProviderConfig.mutate({ id: p.id, config })
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          {(policiesQuery.data || []).map((policy: AuthPolicy) => (
            <PolicyCard
              key={`${policy.id}-${policy.providers.map((x) => x.providerId).join(',')}-${policy.requireMfa}-${policy.groupAllow.join(',')}-${policy.groupDeny.join(',')}`}
              policy={policy}
              providers={providersQuery.data || []}
              domains={domainsQuery.data || []}
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
          <CreateGatewayCard
            providers={providersQuery.data || []}
            domains={(domainsQuery.data || []).filter((d) => !domainsWithGateway.has(d.id))}
            allDomainsCount={(domainsQuery.data || []).length}
            saving={createGateway.isPending}
            onCreate={(body) => createGateway.mutate(body)}
          />
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

function ProviderCard({
  provider,
  toggling,
  saving,
  onToggle,
  onSaveConfig,
}: {
  provider: AuthProviderConfig;
  toggling: boolean;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onSaveConfig: (config: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const configured = isConfigured(provider);
  const cfg = (provider.config || {}) as Record<string, unknown>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{provider.name}</CardTitle>
          <Badge variant={provider.enabled ? 'default' : 'secondary'}>
            {providerTypeLabel(provider.type)}
          </Badge>
        </div>
        <CardDescription>
          {provider.isSystem
            ? t('identity.providers.system')
            : configured
              ? t('identity.providers.optional')
              : t('identity.providers.notConfigured')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={`en-${provider.id}`}>{t('identity.providers.enabled')}</Label>
          <Switch
            id={`en-${provider.id}`}
            checked={provider.enabled}
            disabled={toggling || (!configured && !provider.enabled)}
            onCheckedChange={onToggle}
          />
        </div>

        {provider.type === 'local' && (
          <p className="text-sm text-muted-foreground">{t('identity.providers.localHint')}</p>
        )}

        {provider.type === 'ldap' && (
          <LdapConfigForm
            initial={cfg}
            saving={saving}
            onSave={onSaveConfig}
          />
        )}

        {(provider.type === 'oidc_entra' || provider.type === 'oidc_generic') && (
          <OidcConfigForm
            type={provider.type}
            initial={cfg}
            saving={saving}
            onSave={onSaveConfig}
          />
        )}
      </CardContent>
    </Card>
  );
}

function LdapConfigForm({
  initial,
  saving,
  onSave,
}: {
  initial: Record<string, unknown>;
  saving: boolean;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    url: String(initial.url || ''),
    bindDn: String(initial.bindDn || ''),
    bindPassword: '',
    searchBase: String(initial.searchBase || ''),
    searchFilter: String(initial.searchFilter || '(uid={{username}})'),
    groupBase: String(initial.groupBase || ''),
    groupFilter: String(initial.groupFilter || ''),
    startTls: Boolean(initial.startTls),
    tlsRejectUnauthorized: initial.tlsRejectUnauthorized !== false,
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-3 border-t pt-3">
      <div>
        <Label htmlFor="ldap-url">{t('identity.providers.ldapUrl')}</Label>
        <Input
          id="ldap-url"
          className="mt-1"
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="ldaps://ldap.example.com:636"
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ldap-bind">{t('identity.providers.bindDn')}</Label>
          <Input
            id="ldap-bind"
            className="mt-1"
            value={form.bindDn}
            onChange={(e) => set('bindDn', e.target.value)}
            placeholder="cn=svc,ou=people,dc=example,dc=com"
          />
        </div>
        <div>
          <Label htmlFor="ldap-pw">{t('identity.providers.bindPassword')}</Label>
          <Input
            id="ldap-pw"
            type="password"
            className="mt-1"
            value={form.bindPassword}
            onChange={(e) => set('bindPassword', e.target.value)}
            placeholder={
              initial.bindPasswordSet ? t('identity.providers.secretKeep') : undefined
            }
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ldap-base">{t('identity.providers.searchBase')}</Label>
        <Input
          id="ldap-base"
          className="mt-1"
          value={form.searchBase}
          onChange={(e) => set('searchBase', e.target.value)}
          placeholder="ou=people,dc=example,dc=com"
        />
      </div>
      <div>
        <Label htmlFor="ldap-filter">{t('identity.providers.searchFilter')}</Label>
        <Input
          id="ldap-filter"
          className="mt-1 font-mono text-sm"
          value={form.searchFilter}
          onChange={(e) => set('searchFilter', e.target.value)}
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ldap-gbase">{t('identity.providers.groupBase')}</Label>
          <Input
            id="ldap-gbase"
            className="mt-1"
            value={form.groupBase}
            onChange={(e) => set('groupBase', e.target.value)}
            placeholder="ou=groups,dc=example,dc=com"
          />
        </div>
        <div>
          <Label htmlFor="ldap-gfilter">{t('identity.providers.groupFilter')}</Label>
          <Input
            id="ldap-gfilter"
            className="mt-1 font-mono text-sm"
            value={form.groupFilter}
            onChange={(e) => set('groupFilter', e.target.value)}
            placeholder="(member={{dn}})"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.startTls} onCheckedChange={(v) => set('startTls', v)} />
          {t('identity.providers.startTls')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={form.tlsRejectUnauthorized}
            onCheckedChange={(v) => set('tlsRejectUnauthorized', v)}
          />
          {t('identity.providers.tlsReject')}
        </label>
      </div>
      <Button
        disabled={saving}
        onClick={() => {
          const payload: Record<string, unknown> = {
            url: form.url.trim(),
            bindDn: form.bindDn.trim() || undefined,
            searchBase: form.searchBase.trim(),
            searchFilter: form.searchFilter.trim(),
            groupBase: form.groupBase.trim() || undefined,
            groupFilter: form.groupFilter.trim() || undefined,
            startTls: form.startTls,
            tlsRejectUnauthorized: form.tlsRejectUnauthorized,
          };
          if (form.bindPassword) payload.bindPassword = form.bindPassword;
          onSave(payload);
        }}
      >
        {t('identity.providers.configure')}
      </Button>
    </div>
  );
}

function OidcConfigForm({
  type,
  initial,
  saving,
  onSave,
}: {
  type: 'oidc_entra' | 'oidc_generic';
  initial: Record<string, unknown>;
  saving: boolean;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    issuer: String(initial.issuer || ''),
    entraTenantId: String(initial.entraTenantId || ''),
    clientId: String(initial.clientId || ''),
    clientSecret: '',
    scopes: String(initial.scopes || 'openid profile email'),
    groupClaim: String(initial.groupClaim || 'groups'),
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-3 border-t pt-3">
      {type === 'oidc_entra' && (
        <div>
          <Label htmlFor="entra-tenant">{t('identity.providers.entraTenant')}</Label>
          <Input
            id="entra-tenant"
            className="mt-1"
            value={form.entraTenantId}
            onChange={(e) => set('entraTenantId', e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
      )}
      <div>
        <Label htmlFor="oidc-issuer">{t('identity.providers.issuer')}</Label>
        <Input
          id="oidc-issuer"
          className="mt-1"
          value={form.issuer}
          onChange={(e) => set('issuer', e.target.value)}
          placeholder={
            type === 'oidc_entra'
              ? 'https://login.microsoftonline.com/{tenant}/v2.0 (optional if tenant set)'
              : 'https://idp.example.com'
          }
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="oidc-cid">{t('identity.providers.clientId')}</Label>
          <Input
            id="oidc-cid"
            className="mt-1"
            value={form.clientId}
            onChange={(e) => set('clientId', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="oidc-secret">{t('identity.providers.clientSecret')}</Label>
          <Input
            id="oidc-secret"
            type="password"
            className="mt-1"
            value={form.clientSecret}
            onChange={(e) => set('clientSecret', e.target.value)}
            placeholder={
              initial.clientSecretSet ? t('identity.providers.secretKeep') : undefined
            }
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="oidc-scopes">{t('identity.providers.scopes')}</Label>
          <Input
            id="oidc-scopes"
            className="mt-1"
            value={form.scopes}
            onChange={(e) => set('scopes', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="oidc-groups">{t('identity.providers.groupClaim')}</Label>
          <Input
            id="oidc-groups"
            className="mt-1"
            value={form.groupClaim}
            onChange={(e) => set('groupClaim', e.target.value)}
          />
        </div>
      </div>
      <Button
        disabled={saving}
        onClick={() => {
          const payload: Record<string, unknown> = {
            issuer: form.issuer.trim() || undefined,
            entraTenantId: form.entraTenantId.trim() || undefined,
            clientId: form.clientId.trim(),
            scopes: form.scopes.trim(),
            groupClaim: form.groupClaim.trim() || 'groups',
          };
          if (form.clientSecret) payload.clientSecret = form.clientSecret;
          onSave(payload);
        }}
      >
        {t('identity.providers.configure')}
      </Button>
    </div>
  );
}

function PolicyCard({
  policy,
  providers,
  domains,
  saving,
  onSave,
  isAdminPortal,
}: {
  policy: AuthPolicy;
  providers: AuthProviderConfig[];
  domains: Array<{ id: string; name: string }>;
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

  const domainName =
    policy.domainId && domains.find((d) => d.id === policy.domainId)?.name;

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
          {isAdminPortal
            ? ` — ${t('identity.policies.portalHint')}`
            : policy.target === 'access_gateway'
              ? ` — ${domainName || policy.domainId} · ${t('identity.policies.gatewayHint')}`
              : ''}
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
                    disabled={!p.enabled && !selected.has(p.id)}
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

function CreateGatewayCard({
  providers,
  domains,
  allDomainsCount,
  saving,
  onCreate,
}: {
  providers: AuthProviderConfig[];
  domains: Array<{ id: string; name: string }>;
  allDomainsCount: number;
  saving: boolean;
  onCreate: (body: Parameters<typeof identityService.createGatewayPolicy>[0]) => void;
}) {
  const { t } = useTranslation();
  const enabledProviders = providers.filter((p) => p.enabled);
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [providerIds, setProviderIds] = useState<string[]>(
    enabledProviders.map((p) => p.id)
  );
  const [groupAllow, setGroupAllow] = useState('');
  const [groupDeny, setGroupDeny] = useState('');

  const toggleProvider = (id: string) => {
    setProviderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('identity.policies.createGateway')}</CardTitle>
        <CardDescription>{t('identity.policies.createGatewayHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {allDomainsCount === 0 ? (
          <p className="text-sm text-muted-foreground">{t('identity.policies.noDomains')}</p>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('identity.policies.allGatewaysExist')}
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gw-name">{t('identity.policies.gatewayName')}</Label>
                <Input
                  id="gw-name"
                  className="mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Internal apps gateway"
                />
              </div>
              <div>
                <Label htmlFor="gw-domain">{t('identity.policies.domain')}</Label>
                <select
                  id="gw-domain"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={domainId}
                  onChange={(e) => {
                    setDomainId(e.target.value);
                    const d = domains.find((x) => x.id === e.target.value);
                    if (d && !name) setName(`Gateway: ${d.name}`);
                  }}
                >
                  <option value="">{t('identity.policies.selectDomain')}</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t('identity.policies.allowedIdps')}</Label>
              <div className="flex flex-wrap gap-3">
                {enabledProviders.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={providerIds.includes(p.id)}
                      onChange={() => toggleProvider(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
                {enabledProviders.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Enable at least one identity provider first.
                  </span>
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{t('identity.policies.groupAllow')}</Label>
                <textarea
                  className="mt-1 w-full min-h-[72px] border rounded-md p-2 text-sm bg-background"
                  value={groupAllow}
                  onChange={(e) => setGroupAllow(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('identity.policies.groupDeny')}</Label>
                <textarea
                  className="mt-1 w-full min-h-[72px] border rounded-md p-2 text-sm bg-background"
                  value={groupDeny}
                  onChange={(e) => setGroupDeny(e.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={saving || !domainId || !name.trim() || providerIds.length === 0}
              onClick={() =>
                onCreate({
                  name: name.trim(),
                  domainId,
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
              {t('identity.policies.create')}
            </Button>
          </>
        )}
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
