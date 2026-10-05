import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const ALERT_KINDS = ['availability', 'backup_age', 'node_stale', 'job_failed'] as const;
export const POLICY_KINDS = ['require_mfa', 'backup_max_age', 'node_heartbeat_max_age'] as const;

export interface EnvironmentRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ServiceAccountRecord {
  id: string;
  name: string;
  role: string;
  environmentId: string | null;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  actor: string;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface RunbookRecord {
  id: string;
  environmentId: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleRecord {
  id: string;
  name: string;
  kind: string;
  threshold: number;
  enabled: boolean;
  environmentId: string | null;
}

export interface PolicyRecord {
  id: string;
  name: string;
  kind: string;
  threshold: number | null;
  enabled: boolean;
  environmentId: string | null;
}

export interface SnapshotRecord {
  id: string;
  actor: string;
  createdAt: string;
  body?: PlatformDocument;
}

export interface PlatformDocument {
  environments: EnvironmentRecord[];
  runbooks: RunbookRecord[];
  alertRules: RuleRecord[];
  policies: PolicyRecord[];
}

export interface FleetSignals {
  up: boolean;
  adminsWithoutMfa: string[];
  newestBackupAt: string | null;
  nodes: Array<{ id: string; name: string; lastSeenAt: string | null }>;
  failedJobs: number;
}

export interface Violation {
  policyId: string;
  policyName: string;
  resourceId: string;
  detail: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newServiceToken(): string {
  return `nw_${randomBytes(24).toString('hex')}`;
}

export function evaluatePolicies(policies: PolicyRecord[], signals: FleetSignals, now = Date.now()): Violation[] {
  const violations: Violation[] = [];
  for (const policy of policies.filter((item) => item.enabled)) {
    if (policy.kind === 'require_mfa') {
      for (const name of signals.adminsWithoutMfa) {
        violations.push({ policyId: policy.id, policyName: policy.name, resourceId: name, detail: `admin ${name} has MFA disabled` });
      }
    }
    if (policy.kind === 'backup_max_age') {
      const ageHours = signals.newestBackupAt ? (now - Date.parse(signals.newestBackupAt)) / 36e5 : Number.POSITIVE_INFINITY;
      const limit = policy.threshold ?? 24;
      if (ageHours > limit) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          resourceId: 'fleet',
          detail: signals.newestBackupAt ? `newest backup is ${ageHours.toFixed(1)}h old` : 'no successful backup',
        });
      }
    }
    if (policy.kind === 'node_heartbeat_max_age') {
      const limit = policy.threshold ?? 120;
      for (const node of signals.nodes) {
        const age = node.lastSeenAt ? (now - Date.parse(node.lastSeenAt)) / 1000 : Number.POSITIVE_INFINITY;
        if (age > limit) violations.push({ policyId: policy.id, policyName: policy.name, resourceId: node.id, detail: `${node.name} heartbeat is stale` });
      }
    }
  }
  return violations;
}

export function prometheusText(sample: { jobs: Record<string, number>; nodes: number; alertRules: number }): string {
  const lines = [
    '# HELP warden_up Nginx Warden API is serving.',
    '# TYPE warden_up gauge',
    'warden_up 1',
    '# HELP warden_nodes Registered slave nodes.',
    '# TYPE warden_nodes gauge',
    `warden_nodes ${sample.nodes}`,
    '# HELP warden_alert_rules Platform alert rules.',
    '# TYPE warden_alert_rules gauge',
    `warden_alert_rules ${sample.alertRules}`,
    '# HELP warden_jobs Platform jobs by status.',
    '# TYPE warden_jobs gauge',
  ];
  for (const status of ['succeeded', 'failed', 'running']) {
    lines.push(`warden_jobs{status="${status}"} ${sample.jobs[status] ?? 0}`);
  }
  return `${lines.join('\n')}\n`;
}

export class MemoryPlatformStore {
  environments: EnvironmentRecord[] = [];
  accounts: Array<ServiceAccountRecord & { tokenHash: string }> = [];
  jobs: JobRecord[] = [];
  runbooks: RunbookRecord[] = [];
  rules: RuleRecord[] = [];
  policies: PolicyRecord[] = [];
  snapshots: SnapshotRecord[] = [];
  signals: FleetSignals = { up: true, adminsWithoutMfa: [], newestBackupAt: null, nodes: [], failedJobs: 0 };
  audit: Array<{ actor: string; action: string; detail: string; createdAt: string }> = [];

  constructor() {
    this.seed();
  }

  seed(): void {
    if (this.environments.length === 0) {
      this.environments.push({ id: 'env-default', name: 'default', description: 'Initial environment', createdAt: new Date().toISOString() });
    }
    this.ensureRule('Availability', 'availability', 1);
    this.ensureRule('Backup age', 'backup_age', 24);
    this.ensureRule('Node heartbeat', 'node_stale', 120);
    this.ensureRule('Failed jobs', 'job_failed', 0);
    this.ensurePolicy('Require MFA', 'require_mfa', null);
    this.ensurePolicy('Backup maximum age', 'backup_max_age', 24);
    this.ensurePolicy('Node heartbeat age', 'node_heartbeat_max_age', 120);
  }

  listEnvironments() {
    return this.environments;
  }

  createEnvironment(input: { name: string; description?: string }) {
    const name = required(input.name, 'name');
    if (this.environments.some((item) => item.name === name)) throw Object.assign(new Error('Environment already exists'), { status: 409 });
    const record: EnvironmentRecord = { id: randomUUID(), name, description: input.description?.trim() ?? '', createdAt: new Date().toISOString() };
    this.environments.push(record);
    return record;
  }

  listAccounts() {
    return this.accounts.map(({ tokenHash: _token, ...account }) => account);
  }

  createAccount(input: { name: string; role: string; environmentId?: string | null }) {
    if (!['admin', 'moderator', 'viewer'].includes(input.role)) throw Object.assign(new Error('Role must be admin, moderator, or viewer'), { status: 400 });
    const name = required(input.name, 'name');
    if (this.accounts.some((item) => item.name === name)) throw Object.assign(new Error('Service account already exists'), { status: 409 });
    if (input.environmentId && !this.environments.some((item) => item.id === input.environmentId)) {
      throw Object.assign(new Error('environmentId does not match an environment'), { status: 400 });
    }
    const token = newServiceToken();
    const record = {
      id: randomUUID(),
      name,
      role: input.role,
      environmentId: input.environmentId ?? null,
      createdAt: new Date().toISOString(),
      tokenHash: hashToken(token),
    };
    this.accounts.push(record);
    return { ...record, token };
  }

  deleteAccount(id: string) {
    const before = this.accounts.length;
    this.accounts = this.accounts.filter((item) => item.id !== id);
    if (this.accounts.length === before) throw Object.assign(new Error('Service account not found'), { status: 404 });
  }

  findAccount(token: string) {
    const hash = hashToken(token);
    const account = this.accounts.find((item) => item.tokenHash === hash);
    if (!account) return null;
    return { id: account.id, name: account.name, role: account.role, environmentId: account.environmentId };
  }

  listJobs() {
    return this.jobs;
  }

  addJob(type: string, actor: string, status = 'succeeded', error: string | null = null): JobRecord {
    const record: JobRecord = { id: randomUUID(), type, status, actor, error, createdAt: new Date().toISOString(), finishedAt: new Date().toISOString() };
    this.jobs.push(record);
    return record;
  }

  listRunbooks(environmentId?: string) {
    return this.runbooks.filter((item) => !environmentId || item.environmentId === environmentId);
  }

  createRunbook(input: { title: string; body: string; environmentId?: string | null }) {
    const now = new Date().toISOString();
    const record: RunbookRecord = {
      id: randomUUID(),
      title: required(input.title, 'title'),
      body: input.body ?? '',
      environmentId: input.environmentId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.runbooks.push(record);
    return record;
  }

  listRules() {
    return this.rules;
  }

  createRule(input: { name: string; kind: string; threshold: number; environmentId?: string | null }) {
    if (!ALERT_KINDS.includes(input.kind as (typeof ALERT_KINDS)[number])) throw Object.assign(new Error(`kind must be ${ALERT_KINDS.join(', ')}`), { status: 400 });
    const record: RuleRecord = {
      id: randomUUID(),
      name: required(input.name, 'name'),
      kind: input.kind,
      threshold: input.threshold,
      enabled: true,
      environmentId: input.environmentId ?? null,
    };
    this.rules.push(record);
    return record;
  }

  setRuleEnabled(id: string, enabled: boolean) {
    const rule = this.rules.find((item) => item.id === id);
    if (!rule) throw Object.assign(new Error('Alert rule not found'), { status: 404 });
    rule.enabled = enabled;
    return rule;
  }

  listPolicies() {
    return this.policies;
  }

  createPolicy(input: { name: string; kind: string; threshold?: number | null; environmentId?: string | null }) {
    if (!POLICY_KINDS.includes(input.kind as (typeof POLICY_KINDS)[number])) throw Object.assign(new Error(`kind must be ${POLICY_KINDS.join(', ')}`), { status: 400 });
    const record: PolicyRecord = {
      id: randomUUID(),
      name: required(input.name, 'name'),
      kind: input.kind,
      threshold: input.threshold ?? null,
      enabled: true,
      environmentId: input.environmentId ?? null,
    };
    this.policies.push(record);
    return record;
  }

  setPolicyEnabled(id: string, enabled: boolean) {
    const policy = this.policies.find((item) => item.id === id);
    if (!policy) throw Object.assign(new Error('Policy not found'), { status: 404 });
    policy.enabled = enabled;
    return policy;
  }

  violations() {
    return evaluatePolicies(this.policies, this.signals);
  }

  document(): PlatformDocument {
    return { environments: this.environments, runbooks: this.runbooks, alertRules: this.rules, policies: this.policies };
  }

  createSnapshot(actor: string) {
    const record: SnapshotRecord = { id: randomUUID(), actor, createdAt: new Date().toISOString(), body: this.document() };
    this.snapshots.push(record);
    this.addJob('snapshot', actor);
    return { id: record.id, actor, createdAt: record.createdAt };
  }

  listSnapshots() {
    return this.snapshots.map(({ body: _body, ...item }) => item);
  }

  applySnapshot(id: string) {
    const snapshot = this.snapshots.find((item) => item.id === id);
    if (!snapshot?.body) throw Object.assign(new Error('Snapshot not found'), { status: 404 });
    this.applyDocument(snapshot.body);
  }

  applyDocument(body: PlatformDocument) {
    for (const item of body.environments ?? []) {
      const existing = this.environments.find((environment) => environment.id === item.id);
      if (existing) Object.assign(existing, item);
      else this.environments.push(item);
    }
    this.runbooks = body.runbooks ?? [];
    this.policies = body.policies ?? [];
    this.rules = body.alertRules ?? [];
  }

  exportAudit() {
    return this.audit;
  }

  metrics() {
    const jobs: Record<string, number> = {};
    for (const job of this.jobs) jobs[job.status] = (jobs[job.status] ?? 0) + 1;
    return { jobs, nodes: this.signals.nodes.length, alertRules: this.rules.length, up: this.signals.up ? 1 : 0 };
  }

  private ensureRule(name: string, kind: string, threshold: number) {
    if (!this.rules.some((item) => item.kind === kind)) this.rules.push({ id: randomUUID(), name, kind, threshold, enabled: true, environmentId: null });
  }

  private ensurePolicy(name: string, kind: string, threshold: number | null) {
    if (!this.policies.some((item) => item.kind === kind)) this.policies.push({ id: randomUUID(), name, kind, threshold, enabled: true, environmentId: null });
  }
}

function required(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw Object.assign(new Error(`${field} is required`), { status: 400 });
  return trimmed;
}
