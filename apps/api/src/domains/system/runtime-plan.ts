export type RuntimeComponent = 'node' | 'postgres';

export interface RuntimeTarget {
  script: string;
  args: string[];
  confirm: string;
}

/** Node 22 is the newest LTS Prisma 5 in this API can run. Node 24 is the current LTS. */
export const runtimeTargets: Record<RuntimeComponent, RuntimeTarget> = {
  node: { script: 'upgrade-node.sh', args: ['22'], confirm: 'UPGRADE_NODE_CONFIRM' },
  postgres: { script: 'upgrade-postgres.sh', args: ['18'], confirm: 'UPGRADE_POSTGRES_CONFIRM' },
};

export interface RuntimeRow {
  id: RuntimeComponent | 'pnpm';
  current: string;
  newInstall: string;
  latestLts: string;
  note: string;
  canRun: boolean;
}

export function describeRuntimes(nodeVersion: string): RuntimeRow[] {
  return [
    {
      id: 'node',
      current: nodeVersion,
      newInstall: '22',
      latestLts: '24',
      note: 'A machine with no Node gets 22. Node 24 is the current long-term support release. Prisma 5 in this API does not run on it, so the console moves a server to 22.',
      canRun: true,
    },
    {
      id: 'postgres',
      current: 'the nginx-warden-postgres container',
      newInstall: '18',
      latestLts: '18',
      note: 'A new volume uses Postgres 18. This action copies an older database beside it and leaves the live one running.',
      canRun: true,
    },
    {
      id: 'pnpm',
      current: '8.15.0',
      newInstall: '8.15.0',
      latestLts: '8.15.0',
      note: 'pnpm has no long-term support line. It follows packageManager in package.json so the lockfile still installs.',
      canRun: false,
    },
  ];
}

export function planRuntime(component: string, allow: boolean): { component: RuntimeComponent; executed: boolean; detail: string } {
  if (component !== 'node' && component !== 'postgres') {
    throw new Error('component must be node or postgres');
  }
  const spec = runtimeTargets[component];
  const detail = `bash scripts/${spec.script} ${spec.args.join(' ')}`;
  if (!allow) {
    return { component, executed: false, detail: `${detail} (set WARDEN_ALLOW_HOST_UPDATE=1 to run it)` };
  }
  return { component, executed: true, detail: `scheduled: ${detail}` };
}
