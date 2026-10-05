import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface Environment {
  id: string;
  name: string;
}

export default function Platform() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const environments = useQuery({ queryKey: ['platform-environments'], queryFn: async () => (await api.get('/platform/environments')).data.data as Environment[] });

  function submit(path: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      void api.post(path, data).then(() => {
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
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
