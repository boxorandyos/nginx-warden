import { FormEvent, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <Section title="Fleet rules">
        {rules.data?.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{rule.name} · {rule.kind} · {rule.threshold}</span>
            <button className="border px-2 py-1" onClick={() => void api.patch(`/platform/alert-rules/${rule.id}`, { enabled: !rule.enabled }).then(refresh)}>
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={create}>
          <input name="name" required placeholder="Name" className="h-10 border px-2" />
          <select name="kind" className="h-10 border px-2">{ALERT_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <input name="threshold" type="number" min={0} required placeholder="Threshold" className="h-10 w-28 border px-2" />
          <button className="h-10 border px-3">Add rule</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function MetricsPage() {
  const metrics = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => (await api.get('/platform/metrics')).data.data as Record<string, unknown>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Metrics</h1>
      <Section title="Platform">
        <pre className="overflow-auto text-xs">{JSON.stringify(metrics.data ?? {}, null, 2)}</pre>
      </Section>
    </div>
  );
}

export function JobsPage() {
  const jobs = useQuery({
    queryKey: ['platform-jobs'],
    queryFn: async () => (await api.get('/platform/jobs')).data.data as Array<{ id: string; type: string; status: string }>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <Section title="History">
        {jobs.data?.map((job) => <p key={job.id}>{job.type} · {job.status}</p>)}
        {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">No jobs have run yet.</p>}
      </Section>
    </div>
  );
}

export function RunbooksPage() {
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
      <h1 className="text-2xl font-semibold">Runbooks</h1>
      <Section title="Procedures">
        {runbooks.data?.map((item) => <p key={item.id}>{item.title}</p>)}
        <form className="mt-3 flex gap-2" onSubmit={create}>
          <input name="title" required placeholder="Title" className="h-10 border px-2" />
          <input name="body" placeholder="Steps" className="h-10 flex-1 border px-2" />
          <button className="h-10 border px-3">Add</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function HardeningPage() {
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
      <h1 className="text-2xl font-semibold">Hardening</h1>
      <Section title="Violations">
        {violations.data?.length === 0 && <p className="text-sm text-muted-foreground">No policy violations.</p>}
        {violations.data?.map((item, index) => (
          <p key={index}>{item.policyName || item.name}: {item.detail}</p>
        ))}
      </Section>
      <Section title="Policies">
        {policies.data?.map((policy) => (
          <div key={policy.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{policy.name} · {policy.kind}</span>
            <button className="border px-2 py-1" onClick={() => void api.patch(`/platform/policies/${policy.id}`, { enabled: !policy.enabled }).then(refresh)}>
              {policy.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={create}>
          <input name="name" required placeholder="Name" className="h-10 border px-2" />
          <select name="kind" className="h-10 border px-2">{POLICY_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
          <input name="threshold" type="number" min={0} placeholder="Threshold" className="h-10 w-28 border px-2" />
          <button className="h-10 border px-3">Add policy</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function AuditPage() {
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
        <h1 className="text-2xl font-semibold">Audit</h1>
        <button className="h-10 border px-3" onClick={() => void download()}>Export CSV</button>
      </div>
      <Section title="Log">
        {rows.data?.map((row, index) => (
          <p key={index} className="border-t py-2 text-sm">{row.createdAt} · {row.actor} · {row.action} · {row.detail}</p>
        ))}
      </Section>
    </div>
  );
}

export function ServiceAccountsPage() {
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
      <h1 className="text-2xl font-semibold">Service Accounts</h1>
      <Section title="Accounts">
        {accounts.data?.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-t py-2 text-sm">
            <span>{item.name} · {item.role}</span>
            <button className="border px-2 py-1" onClick={() => void api.delete(`/platform/service-accounts/${item.id}`).then(refresh)}>Delete</button>
          </div>
        ))}
        {token && <p className="mt-2 font-mono text-sm">Token (shown once): {token}</p>}
        <form className="mt-3 flex gap-2" onSubmit={create}>
          <input name="name" required placeholder="Name" className="h-10 border px-2" />
          <select name="role" className="h-10 border px-2"><option>viewer</option><option>moderator</option><option>admin</option></select>
          <button className="h-10 border px-3">Create</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>
    </div>
  );
}

export function SnapshotsPage() {
  const refresh = useInvalidate();
  const [notice, setNotice] = useState('');
  const snapshots = useQuery({
    queryKey: ['platform-snapshots'],
    queryFn: async () => (await api.get('/platform/snapshots')).data.data as Array<{ id: string; createdAt: string }>,
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Snapshots</h1>
      <p className="text-sm text-muted-foreground">A snapshot is the platform document: environments, runbooks, alert rules, and policies.</p>
      <Section title="Platform document">
        <div className="mb-3 flex gap-2">
          <button className="h-10 border px-3" onClick={() => void api.post('/platform/snapshots').then(refresh)}>Capture</button>
          <button className="h-10 border px-3" onClick={() => void api.post('/platform/sync').then((response) => setNotice(`${response.data?.data?.length ?? 0} slaves contacted`))}>Push to slaves</button>
        </div>
        {snapshots.data?.map((snapshot) => (
          <button key={snapshot.id} className="mr-2 text-sm underline" onClick={() => void api.post(`/platform/snapshots/${snapshot.id}/apply`)}>
            Apply {snapshot.createdAt}
          </button>
        ))}
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      </Section>
    </div>
  );
}
