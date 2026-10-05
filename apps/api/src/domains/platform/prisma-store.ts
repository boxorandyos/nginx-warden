import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import {
  ALERT_KINDS,
  POLICY_KINDS,
  hashToken,
  newServiceToken,
  evaluatePolicies,
  type EnvironmentRecord,
  type FleetSignals,
  type JobRecord,
  type PlatformDocument,
  type PolicyRecord,
  type RuleRecord,
  type RunbookRecord,
  type ServiceAccountRecord,
} from './platform';

type Row = Record<string, unknown>;

export class PrismaPlatformStore {
  async seed(): Promise<void> {
    const count = await prisma.$queryRawUnsafe<Array<{ c: number }>>('SELECT COUNT(*)::int AS c FROM platform_environments');
    if (Number(count[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_environments (id, name, description) VALUES ($1, $2, $3)',
        'env-default',
        'default',
        'Initial environment',
      );
    }
    await this.ensureRule('Availability', 'availability', 1);
    await this.ensureRule('Backup age', 'backup_age', 24);
    await this.ensureRule('Node heartbeat', 'node_stale', 120);
    await this.ensureRule('Failed jobs', 'job_failed', 0);
    await this.ensurePolicy('Require MFA', 'require_mfa', null);
    await this.ensurePolicy('Backup maximum age', 'backup_max_age', 24);
    await this.ensurePolicy('Node heartbeat age', 'node_heartbeat_max_age', 120);
  }

  async listEnvironments(): Promise<EnvironmentRecord[]> {
    await this.seed();
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id, name, description, created_at FROM platform_environments ORDER BY name');
    return rows.map(mapEnvironment);
  }

  async createEnvironment(input: { name: string; description?: string }): Promise<EnvironmentRecord> {
    const name = required(input.name, 'name');
    const record = { id: randomUUID(), name, description: input.description?.trim() ?? '', createdAt: new Date().toISOString() };
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_environments (id, name, description, created_at) VALUES ($1, $2, $3, $4)',
        record.id,
        record.name,
        record.description,
        record.createdAt,
      );
    } catch (error) {
      throw Object.assign(new Error('Environment already exists'), { status: 409, cause: error });
    }
    return record;
  }

  async listAccounts(): Promise<ServiceAccountRecord[]> {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id, name, role, environment_id, created_at FROM platform_service_accounts ORDER BY name');
    return rows.map(mapAccount);
  }

  async createAccount(input: { name: string; role: string; environmentId?: string | null }): Promise<ServiceAccountRecord & { token: string }> {
    if (!['admin', 'moderator', 'viewer'].includes(input.role)) throw Object.assign(new Error('Role must be admin, moderator, or viewer'), { status: 400 });
    const name = required(input.name, 'name');
    const token = newServiceToken();
    const record = { id: randomUUID(), name, role: input.role, environmentId: input.environmentId ?? null, createdAt: new Date().toISOString() };
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_service_accounts (id, name, role, token_hash, environment_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        record.id,
        record.name,
        record.role,
        hashToken(token),
        record.environmentId,
        record.createdAt,
      );
    } catch (error) {
      throw Object.assign(new Error('Service account already exists'), { status: 409, cause: error });
    }
    return { ...record, token };
  }

  async deleteAccount(id: string): Promise<void> {
    const count = await prisma.$executeRawUnsafe('DELETE FROM platform_service_accounts WHERE id = $1', id);
    if (count === 0) throw Object.assign(new Error('Service account not found'), { status: 404 });
  }

  async findAccount(token: string): Promise<{ id: string; name: string; role: string; environmentId: string | null } | null> {
    if (!token.startsWith('nw_')) return null;
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id, name, role, environment_id FROM platform_service_accounts WHERE token_hash = $1', hashToken(token));
    return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name), role: String(rows[0].role), environmentId: (rows[0].environment_id as string | null) ?? null } : null;
  }

  async listJobs(): Promise<JobRecord[]> {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id, type, status, actor, error, created_at, finished_at FROM platform_jobs ORDER BY created_at DESC LIMIT 200');
    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      status: String(row.status),
      actor: String(row.actor),
      error: (row.error as string | null) ?? null,
      createdAt: String(row.created_at),
      finishedAt: row.finished_at ? String(row.finished_at) : null,
    }));
  }

  async addJob(type: string, actor: string, status = 'succeeded', error: string | null = null): Promise<JobRecord> {
    const record: JobRecord = { id: randomUUID(), type, status, actor, error, createdAt: new Date().toISOString(), finishedAt: new Date().toISOString() };
    await prisma.$executeRawUnsafe(
      'INSERT INTO platform_jobs (id, type, status, actor, error, created_at, finished_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      record.id,
      record.type,
      record.status,
      record.actor,
      record.error,
      record.createdAt,
      record.finishedAt,
    );
    return record;
  }

  async listRunbooks(environmentId?: string): Promise<RunbookRecord[]> {
    const rows = environmentId
      ? await prisma.$queryRawUnsafe<Row[]>('SELECT * FROM platform_runbooks WHERE environment_id = $1 ORDER BY title', environmentId)
      : await prisma.$queryRawUnsafe<Row[]>('SELECT * FROM platform_runbooks ORDER BY title');
    return rows.map(mapRunbook);
  }

  async createRunbook(input: { title: string; body: string; environmentId?: string | null }): Promise<RunbookRecord> {
    const now = new Date().toISOString();
    const record: RunbookRecord = { id: randomUUID(), title: required(input.title, 'title'), body: input.body ?? '', environmentId: input.environmentId ?? null, createdAt: now, updatedAt: now };
    await prisma.$executeRawUnsafe(
      'INSERT INTO platform_runbooks (id, environment_id, title, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      record.id,
      record.environmentId,
      record.title,
      record.body,
      record.createdAt,
      record.updatedAt,
    );
    return record;
  }

  async listRules(): Promise<RuleRecord[]> {
    await this.seed();
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT * FROM platform_alert_rules ORDER BY name');
    return rows.map(mapRule);
  }

  async createRule(input: { name: string; kind: string; threshold: number; environmentId?: string | null }): Promise<RuleRecord> {
    if (!ALERT_KINDS.includes(input.kind as (typeof ALERT_KINDS)[number])) throw Object.assign(new Error(`kind must be ${ALERT_KINDS.join(', ')}`), { status: 400 });
    const record: RuleRecord = { id: randomUUID(), name: required(input.name, 'name'), kind: input.kind, threshold: Number(input.threshold), enabled: true, environmentId: input.environmentId ?? null };
    await prisma.$executeRawUnsafe(
      'INSERT INTO platform_alert_rules (id, name, kind, threshold, enabled, environment_id) VALUES ($1, $2, $3, $4, TRUE, $5)',
      record.id,
      record.name,
      record.kind,
      record.threshold,
      record.environmentId,
    );
    return record;
  }

  async setRuleEnabled(id: string, enabled: boolean): Promise<RuleRecord> {
    const count = await prisma.$executeRawUnsafe('UPDATE platform_alert_rules SET enabled = $1 WHERE id = $2', enabled, id);
    if (count === 0) throw Object.assign(new Error('Alert rule not found'), { status: 404 });
    const rows = await this.listRules();
    const rule = rows.find((item) => item.id === id);
    if (!rule) throw Object.assign(new Error('Alert rule not found'), { status: 404 });
    return rule;
  }

  async listPolicies(): Promise<PolicyRecord[]> {
    await this.seed();
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT * FROM platform_policies ORDER BY name');
    return rows.map(mapPolicy);
  }

  async createPolicy(input: { name: string; kind: string; threshold?: number | null; environmentId?: string | null }): Promise<PolicyRecord> {
    if (!POLICY_KINDS.includes(input.kind as (typeof POLICY_KINDS)[number])) throw Object.assign(new Error(`kind must be ${POLICY_KINDS.join(', ')}`), { status: 400 });
    const record: PolicyRecord = { id: randomUUID(), name: required(input.name, 'name'), kind: input.kind, threshold: input.threshold ?? null, enabled: true, environmentId: input.environmentId ?? null };
    await prisma.$executeRawUnsafe(
      'INSERT INTO platform_policies (id, name, kind, threshold, enabled, environment_id) VALUES ($1, $2, $3, $4, TRUE, $5)',
      record.id,
      record.name,
      record.kind,
      record.threshold,
      record.environmentId,
    );
    return record;
  }

  async setPolicyEnabled(id: string, enabled: boolean): Promise<PolicyRecord> {
    const count = await prisma.$executeRawUnsafe('UPDATE platform_policies SET enabled = $1 WHERE id = $2', enabled, id);
    if (count === 0) throw Object.assign(new Error('Policy not found'), { status: 404 });
    const policy = (await this.listPolicies()).find((item) => item.id === id);
    if (!policy) throw Object.assign(new Error('Policy not found'), { status: 404 });
    return policy;
  }

  async signals(): Promise<FleetSignals> {
    const admins = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT u.username FROM users u LEFT JOIN two_factor_auth t ON t."userId" = u.id WHERE u.role = 'admin' AND (t.enabled IS NULL OR t.enabled = FALSE)`,
    );
    const backups = await prisma.$queryRawUnsafe<Row[]>(`SELECT created_at FROM backup_files WHERE status = 'success' ORDER BY created_at DESC LIMIT 1`).catch(() => []);
    const nodes = await prisma.$queryRawUnsafe<Row[]>(`SELECT id, name, "lastSeen" AS last_seen FROM slave_nodes`);
    const failed = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c FROM platform_jobs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'`,
    );
    return {
      up: true,
      adminsWithoutMfa: admins.map((row) => String(row.username)),
      newestBackupAt: backups[0]?.created_at ? String(backups[0].created_at) : null,
      nodes: nodes.map((row) => ({ id: String(row.id), name: String(row.name), lastSeenAt: row.last_seen ? String(row.last_seen) : null })),
      failedJobs: Number(failed[0]?.c ?? 0),
    };
  }

  async violations() {
    return evaluatePolicies(await this.listPolicies(), await this.signals());
  }

  async document(): Promise<PlatformDocument> {
    return { environments: await this.listEnvironments(), runbooks: await this.listRunbooks(), alertRules: await this.listRules(), policies: await this.listPolicies() };
  }

  async createSnapshot(actor: string) {
    const body = await this.document();
    const record = { id: randomUUID(), actor, createdAt: new Date().toISOString() };
    await prisma.$executeRawUnsafe('INSERT INTO platform_snapshots (id, actor, body, created_at) VALUES ($1, $2, $3::jsonb, $4)', record.id, actor, JSON.stringify(body), record.createdAt);
    await this.addJob('snapshot', actor);
    return record;
  }

  async listSnapshots() {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id, actor, created_at FROM platform_snapshots ORDER BY created_at DESC');
    return rows.map((row) => ({ id: String(row.id), actor: String(row.actor), createdAt: String(row.created_at) }));
  }

  async applySnapshot(id: string) {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT body FROM platform_snapshots WHERE id = $1', id);
    if (!rows[0]) throw Object.assign(new Error('Snapshot not found'), { status: 404 });
    const body = (typeof rows[0].body === 'string' ? JSON.parse(rows[0].body) : rows[0].body) as PlatformDocument;
    await this.applyDocument(body);
  }

  async applyDocument(body: PlatformDocument) {
    for (const item of body.environments ?? []) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO platform_environments (id, name, description, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        item.id,
        item.name,
        item.description,
        item.createdAt,
      );
    }
    await prisma.$executeRawUnsafe('DELETE FROM platform_runbooks');
    for (const item of body.runbooks ?? []) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_runbooks (id, environment_id, title, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        item.id,
        item.environmentId,
        item.title,
        item.body,
        item.createdAt,
        item.updatedAt,
      );
    }
    await prisma.$executeRawUnsafe('DELETE FROM platform_policies');
    for (const item of body.policies ?? []) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_policies (id, name, kind, threshold, enabled, environment_id) VALUES ($1, $2, $3, $4, $5, $6)',
        item.id,
        item.name,
        item.kind,
        item.threshold,
        item.enabled,
        item.environmentId,
      );
    }
    await prisma.$executeRawUnsafe('DELETE FROM platform_alert_rules');
    for (const item of body.alertRules ?? []) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO platform_alert_rules (id, name, kind, threshold, enabled, environment_id) VALUES ($1, $2, $3, $4, $5, $6)',
        item.id,
        item.name,
        item.kind,
        item.threshold,
        item.enabled,
        item.environmentId,
      );
    }
  }

  async exportAudit() {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, action, type::text AS type, COALESCE(details, '') AS detail, timestamp FROM activity_logs ORDER BY timestamp DESC LIMIT 500`,
    );
    return rows.map((row) => ({ id: String(row.id), action: String(row.action), type: String(row.type), detail: String(row.detail), createdAt: String(row.timestamp) }));
  }

  async metrics() {
    const rows = await prisma.$queryRawUnsafe<Array<{ status: string; c: number }>>('SELECT status, COUNT(*)::int AS c FROM platform_jobs GROUP BY status');
    const jobs: Record<string, number> = {};
    for (const row of rows) jobs[row.status] = Number(row.c);
    const nodes = await prisma.$queryRawUnsafe<Array<{ c: number }>>('SELECT COUNT(*)::int AS c FROM slave_nodes');
    const rules = await prisma.$queryRawUnsafe<Array<{ c: number }>>('SELECT COUNT(*)::int AS c FROM platform_alert_rules');
    return { jobs, nodes: Number(nodes[0]?.c ?? 0), alertRules: Number(rules[0]?.c ?? 0), up: 1 };
  }

  async heartbeat(token: string): Promise<boolean> {
    const count = await prisma.$executeRawUnsafe(`UPDATE slave_nodes SET "lastSeen" = NOW(), status = 'online' WHERE "apiKey" = $1`, token);
    return count > 0;
  }

  async listSyncNodes(): Promise<Array<{ id: string; name: string; host: string; port: number; token: string }>> {
    const rows = await prisma.$queryRawUnsafe<Row[]>(`SELECT id, name, host, port, "apiKey" AS token FROM slave_nodes WHERE "syncEnabled" = TRUE`);
    return rows.map((row) => ({ id: String(row.id), name: String(row.name), host: String(row.host), port: Number(row.port), token: String(row.token) }));
  }

  private async ensureRule(name: string, kind: string, threshold: number) {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id FROM platform_alert_rules WHERE kind = $1', kind);
    if (rows.length > 0) return;
    await prisma.$executeRawUnsafe('INSERT INTO platform_alert_rules (id, name, kind, threshold, enabled) VALUES ($1, $2, $3, $4, TRUE)', randomUUID(), name, kind, threshold);
  }

  private async ensurePolicy(name: string, kind: string, threshold: number | null) {
    const rows = await prisma.$queryRawUnsafe<Row[]>('SELECT id FROM platform_policies WHERE kind = $1', kind);
    if (rows.length > 0) return;
    await prisma.$executeRawUnsafe('INSERT INTO platform_policies (id, name, kind, threshold, enabled) VALUES ($1, $2, $3, $4, TRUE)', randomUUID(), name, kind, threshold);
  }
}

function required(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw Object.assign(new Error(`${field} is required`), { status: 400 });
  return trimmed;
}

function mapEnvironment(row: Row): EnvironmentRecord {
  return { id: String(row.id), name: String(row.name), description: String(row.description ?? ''), createdAt: String(row.created_at) };
}

function mapAccount(row: Row): ServiceAccountRecord {
  return { id: String(row.id), name: String(row.name), role: String(row.role), environmentId: (row.environment_id as string | null) ?? null, createdAt: String(row.created_at) };
}

function mapRunbook(row: Row): RunbookRecord {
  return {
    id: String(row.id),
    environmentId: (row.environment_id as string | null) ?? null,
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRule(row: Row): RuleRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind),
    threshold: Number(row.threshold),
    enabled: Boolean(row.enabled),
    environmentId: (row.environment_id as string | null) ?? null,
  };
}

function mapPolicy(row: Row): PolicyRecord {
  return { ...mapRule(row), threshold: row.threshold === null || row.threshold === undefined ? null : Number(row.threshold) };
}

export const platformStore = new PrismaPlatformStore();
