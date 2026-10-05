import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface Environment {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  role: string;
  token?: string;
}

interface Runbook {
  id: string;
  title: string;
  body: string;
}

interface Rule {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
}

export default function Platform() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const environments = useQuery({ queryKey: ['platform-environments'], queryFn: async () => (await api.get('/platform/environments')).data.data as Environment[] });
  const accounts = useQuery({ queryKey: ['platform-accounts'], queryFn: async () => (await api.get('/platform/service-accounts')).data.data as Account[] });
  const runbooks = useQuery({ queryKey: ['platform-runbooks'], queryFn: async () => (await api.get('/platform/runbooks')).data.data as Runbook[] });
  const rules = useQuery({ queryKey: ['platform-rules'], queryFn: async () => (await api.get('/platform/alert-rules')).data.data as Rule[] });
  const jobs = useQuery({ queryKey: ['platform-jobs'], queryFn: async () => (await api.get('/platform/jobs')).data.data as Array<{ id: string; type: string; status: string }> });
  const snapshots = useQuery({ queryKey: ['platform-snapshots'], queryFn: async () => (await api.get('/platform/snapshots')).data.data as Array<{ id: string; createdAt: string }> });

  function submit(path: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      void api.post(path, data).then((response) => {
        if (response.data?.data?.token) setToken(response.data.data.token);
        setError('');
        void queryClient.invalidateQueries();
      }).catch((err: Error) => setError(err.message));
    };
  }

  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Environments</h2>
        {environments.data?.map((item) => <p key={item.id}>{item.name}</p>)}
        <form className="mt-2 flex gap-2" onSubmit={submit('/platform/environments')}>
          <input name="name" required placeholder="Name" className="h-10 border px-2" />
          <button className="h-10 border px-3">Add</button>
        </form>
      </section>
      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Service accounts</h2>
        {accounts.data?.map((item) => <p key={item.id}>{item.name} · {item.role}</p>)}
        {token && <p className="mt-2 font-mono text-sm">Token (shown once): {token}</p>}
        <form className="mt-2 flex gap-2" onSubmit={submit('/platform/service-accounts')}>
          <input name="name" required placeholder="Name" className="h-10 border px-2" />
          <select name="role" className="h-10 border px-2"><option>viewer</option><option>moderator</option><option>admin</option></select>
          <button className="h-10 border px-3">Create</button>
        </form>
      </section>
      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Runbooks</h2>
        {runbooks.data?.map((item) => <p key={item.id}>{item.title}</p>)}
        <form className="mt-2 flex gap-2" onSubmit={submit('/platform/runbooks')}>
          <input name="title" required placeholder="Title" className="h-10 border px-2" />
          <input name="body" placeholder="Steps" className="h-10 flex-1 border px-2" />
          <button className="h-10 border px-3">Add</button>
        </form>
      </section>
      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Alert rules</h2>
        {rules.data?.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between py-1 text-sm">
            <span>{rule.name} · {rule.kind}</span>
            <button onClick={() => void api.patch(`/platform/alert-rules/${rule.id}`, { enabled: !rule.enabled }).then(() => queryClient.invalidateQueries({ queryKey: ['platform-rules'] }))}>
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </section>
      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Jobs and snapshots</h2>
        {jobs.data?.map((job) => <p key={job.id}>{job.type} · {job.status}</p>)}
        <button className="mr-2 h-10 border px-3" onClick={() => void api.post('/platform/snapshots').then(() => queryClient.invalidateQueries({ queryKey: ['platform-snapshots'] }))}>Capture snapshot</button>
        {snapshots.data?.map((snapshot) => (
          <button key={snapshot.id} className="mr-2 text-sm underline" onClick={() => void api.post(`/platform/snapshots/${snapshot.id}/apply`)}>
            Apply {snapshot.createdAt}
          </button>
        ))}
      </section>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
