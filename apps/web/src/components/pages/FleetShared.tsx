import { FormEvent, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';

const ALERT_KINDS = ['availability', 'backup_age', 'node_stale', 'job_failed'];
const POLICY_KINDS = ['require_mfa', 'backup_max_age', 'node_heartbeat_max_age'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries();
}

export function FleetAlertsPage() {
  const { t } = useTranslation();
  const refresh = useInvalidate();
  const [error, setError] = useState('');
  const rules = useQuery({
    queryKey: ['fleet-alerts'],
    queryFn: async () => (await api.get('/platform/alert-rules')).data.data as Array<{ id: string; name: string; kind: string; threshold: number; enabled: boolean }>,
  });
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void api.post('/platform/alert-rules', { name: data.name, kind: data.kind, threshold: Number(data.threshold) })
      .then(() => { setError(''); event.currentTarget.reset(); refresh(); })
      .catch((err: Error) => setError(err.message));
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.alerts.title')}</h1>
      <Section title={t('fleet.alerts.rules')}>
        {rules.data?.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{rule.name} · {rule.kind} · {rule.threshold}</span>
            <button className="border px-2 py-1" onClick={() => void api.patch(`/platform/alert-rules/${rule.id}`, { enabled: !rule.enabled }).then(refresh)}>
              {rule.enabled ? t('fleet.alerts.disable') : t('fleet.alerts.enable')}
            </button>
          </div>
        ))}
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={create}>
          <input name="name" required placeholder={t('fleet.alerts.name')} className="h-10 border px-2" />
          <select name="kind" className="h-10 border px-2">{ALERT_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <input name="threshold" type="number" min={0} required placeholder={t('fleet.alerts.threshold')} className="h-10 w-28 border px-2" />
          <button className="h-10 border px-3">{t('fleet.alerts.addRule')}</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function MetricsPage() {
  const { t } = useTranslation();
  const metrics = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => (await api.get('/platform/metrics')).data.data as Record<string, unknown>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.metrics.title')}</h1>
      <Section title={t('fleet.metrics.platform')}>
        <pre className="overflow-auto text-xs">{JSON.stringify(metrics.data ?? {}, null, 2)}</pre>
      </Section>
    </div>
  );
}

export function JobsPage() {
  const { t } = useTranslation();
  const jobs = useQuery({
    queryKey: ['platform-jobs'],
    queryFn: async () => (await api.get('/platform/jobs')).data.data as Array<{ id: string; type: string; status: string }>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.jobs.title')}</h1>
      <Section title={t('fleet.jobs.history')}>
        {jobs.data?.map((job) => <p key={job.id}>{job.type} · {job.status}</p>)}
        {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('fleet.jobs.empty')}</p>}
      </Section>
    </div>
  );
}

export function RunbooksPage() {
  const { t } = useTranslation();
  const refresh = useInvalidate();
  const [error, setError] = useState('');
  const runbooks = useQuery({
    queryKey: ['platform-runbooks'],
    queryFn: async () => (await api.get('/platform/runbooks')).data.data as Array<{ id: string; title: string; body: string }>,
  });
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void api.post('/platform/runbooks', data).then(() => { setError(''); refresh(); }).catch((err: Error) => setError(err.message));
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.runbooks.title')}</h1>
      <Section title={t('fleet.runbooks.procedures')}>
        {runbooks.data?.map((item) => <p key={item.id}>{item.title}</p>)}
        <form className="mt-3 flex gap-2" onSubmit={create}>
          <input name="title" required placeholder={t('fleet.runbooks.titleField')} className="h-10 border px-2" />
          <input name="body" placeholder={t('fleet.runbooks.steps')} className="h-10 flex-1 border px-2" />
          <button className="h-10 border px-3">{t('fleet.runbooks.add')}</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function HardeningPage() {
  const { t } = useTranslation();
  const refresh = useInvalidate();
  const [error, setError] = useState('');
  const policies = useQuery({
    queryKey: ['platform-policies'],
    queryFn: async () => (await api.get('/platform/policies')).data.data as Array<{ id: string; name: string; kind: string; enabled: boolean }>,
  });
  const violations = useQuery({
    queryKey: ['platform-violations'],
    queryFn: async () => (await api.get('/platform/policies/violations')).data.data as Array<{ policyName?: string; name?: string; detail: string }>,
  });
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void api.post('/platform/policies', { name: data.name, kind: data.kind, threshold: data.threshold === '' ? null : Number(data.threshold) })
      .then(() => { setError(''); refresh(); })
      .catch((err: Error) => setError(err.message));
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.hardening.title')}</h1>
      <Section title={t('fleet.hardening.violations')}>
        {violations.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('fleet.hardening.none')}</p>}
        {violations.data?.map((item, index) => (
          <p key={index}>{item.policyName || item.name}: {item.detail}</p>
        ))}
      </Section>
      <Section title={t('fleet.hardening.policies')}>
        {policies.data?.map((policy) => (
          <div key={policy.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{policy.name} · {policy.kind}</span>
            <button className="border px-2 py-1" onClick={() => void api.patch(`/platform/policies/${policy.id}`, { enabled: !policy.enabled }).then(refresh)}>
              {policy.enabled ? t('fleet.alerts.disable') : t('fleet.alerts.enable')}
            </button>
          </div>
        ))}
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={create}>
          <input name="name" required placeholder={t('fleet.alerts.name')} className="h-10 border px-2" />
          <select name="kind" className="h-10 border px-2">{POLICY_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <input name="threshold" type="number" min={0} placeholder={t('fleet.alerts.threshold')} className="h-10 w-28 border px-2" />
          <button className="h-10 border px-3">{t('fleet.hardening.addPolicy')}</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function AuditPage() {
  const { t } = useTranslation();
  const rows = useQuery({
    queryKey: ['platform-audit'],
    queryFn: async () => (await api.get('/platform/audit/export')).data.data as Array<{ actor?: string; action: string; detail?: string; createdAt: string }>,
  });
  async function download() {
    const response = await api.get('/platform/audit/export', { params: { format: 'csv' }, responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nginx-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('fleet.audit.title')}</h1>
        <button className="h-10 border px-3" onClick={() => void download()}>{t('fleet.audit.export')}</button>
      </div>
      <Section title={t('fleet.audit.log')}>
        {rows.data?.map((row, index) => (
          <p key={index} className="border-t py-2 text-sm">{row.createdAt} · {row.actor} · {row.action} · {row.detail}</p>
        ))}
      </Section>
    </div>
  );
}

export function ServiceAccountsPage() {
  const { t } = useTranslation();
  const refresh = useInvalidate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const accounts = useQuery({
    queryKey: ['platform-accounts'],
    queryFn: async () => (await api.get('/platform/service-accounts')).data.data as Array<{ id: string; name: string; role: string }>,
  });
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void api.post('/platform/service-accounts', data).then((response) => {
      setToken(response.data?.data?.token || '');
      setError('');
      refresh();
    }).catch((err: Error) => setError(err.message));
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.accounts.title')}</h1>
      <Section title={t('fleet.accounts.section')}>
        {accounts.data?.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{item.name} · {item.role}</span>
            <button className="border px-2 py-1" onClick={() => void api.delete(`/platform/service-accounts/${item.id}`).then(refresh)}>{t('fleet.accounts.delete')}</button>
          </div>
        ))}
        {token && <p className="mt-2 font-mono text-sm">{t('fleet.accounts.token', { token })}</p>}
        <form className="mt-3 flex gap-2" onSubmit={create}>
          <input name="name" required placeholder={t('fleet.alerts.name')} className="h-10 border px-2" />
          <select name="role" className="h-10 border px-2"><option>viewer</option><option>moderator</option><option>admin</option></select>
          <button className="h-10 border px-3">{t('fleet.accounts.create')}</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function SnapshotsPage() {
  const { t } = useTranslation();
  const refresh = useInvalidate();
  const [notice, setNotice] = useState('');
  const snapshots = useQuery({
    queryKey: ['platform-snapshots'],
    queryFn: async () => (await api.get('/platform/snapshots')).data.data as Array<{ id: string; createdAt: string }>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t('fleet.snapshots.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('fleet.snapshots.help')}</p>
      <Section title={t('fleet.snapshots.document')}>
        <div className="mb-3 flex gap-2">
          <button className="h-10 border px-3" onClick={() => void api.post('/platform/snapshots').then(refresh)}>{t('fleet.snapshots.capture')}</button>
          <button className="h-10 border px-3" onClick={() => void api.post('/platform/sync').then((response) => setNotice(t('fleet.snapshots.slaves', { count: response.data?.data?.length ?? 0 })))}>{t('fleet.snapshots.push')}</button>
        </div>
        {snapshots.data?.map((snapshot) => (
          <button key={snapshot.id} className="mr-2 text-sm underline" onClick={() => void api.post(`/platform/snapshots/${snapshot.id}/apply`)}>
            {t('fleet.snapshots.apply', { time: snapshot.createdAt })}
          </button>
        ))}
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      </Section>
    </div>
  );
}
