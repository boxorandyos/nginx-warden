-- Identity foundation: multi-IdP, policies, audit, abuse

CREATE TYPE "AuthProviderType" AS ENUM ('local', 'ldap', 'oidc_entra', 'oidc_generic');
CREATE TYPE "AuthRequirementTarget" AS ENUM ('admin_portal', 'access_gateway');
CREATE TYPE "AuthAuditLevel" AS ENUM ('debug', 'info', 'warn', 'error');
CREATE TYPE "AuthAuditOutcome" AS ENUM ('success', 'failure', 'lockout', 'blocked', 'challenge', 'info');
CREATE TYPE "AuthAbuseKind" AS ENUM ('user', 'ip', 'global');

ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authProvider" "AuthProviderType" NOT NULL DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "externalGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "users_authProvider_externalId_idx" ON "users"("authProvider", "externalId");

CREATE TABLE "auth_provider_configs" (
    "id" TEXT NOT NULL,
    "type" "AuthProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_provider_configs_type_name_key" ON "auth_provider_configs"("type", "name");
CREATE INDEX "auth_provider_configs_type_enabled_idx" ON "auth_provider_configs"("type", "enabled");

CREATE TABLE "auth_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target" "AuthRequirementTarget" NOT NULL,
    "domainId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "groupAllow" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "groupDeny" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sessionTtlMinutes" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_policies_slug_key" ON "auth_policies"("slug");
CREATE INDEX "auth_policies_target_enabled_idx" ON "auth_policies"("target", "enabled");
CREATE INDEX "auth_policies_domainId_idx" ON "auth_policies"("domainId");

CREATE TABLE "auth_policy_providers" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "auth_policy_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_policy_providers_policyId_providerId_key" ON "auth_policy_providers"("policyId", "providerId");

ALTER TABLE "auth_policy_providers" ADD CONSTRAINT "auth_policy_providers_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "auth_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_policy_providers" ADD CONSTRAINT "auth_policy_providers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "auth_provider_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_audit_logs" (
    "id" TEXT NOT NULL,
    "level" "AuthAuditLevel" NOT NULL DEFAULT 'info',
    "outcome" "AuthAuditOutcome" NOT NULL,
    "providerType" "AuthProviderType",
    "providerId" TEXT,
    "policyId" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_audit_logs_createdAt_idx" ON "auth_audit_logs"("createdAt");
CREATE INDEX "auth_audit_logs_outcome_createdAt_idx" ON "auth_audit_logs"("outcome", "createdAt");
CREATE INDEX "auth_audit_logs_level_createdAt_idx" ON "auth_audit_logs"("level", "createdAt");
CREATE INDEX "auth_audit_logs_ip_createdAt_idx" ON "auth_audit_logs"("ip", "createdAt");
CREATE INDEX "auth_audit_logs_username_createdAt_idx" ON "auth_audit_logs"("username", "createdAt");

ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "auth_provider_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "auth_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "auth_abuse_states" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "AuthAbuseKind" NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "permanentlyBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastFailureAt" TIMESTAMP(3),
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_abuse_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_abuse_states_key_key" ON "auth_abuse_states"("key");
CREATE INDEX "auth_abuse_states_kind_lockedUntil_idx" ON "auth_abuse_states"("kind", "lockedUntil");

CREATE TABLE "auth_abuse_settings" (
    "id" TEXT NOT NULL,
    "maxFailuresPerUser" INTEGER NOT NULL DEFAULT 5,
    "userLockMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxFailuresPerIp" INTEGER NOT NULL DEFAULT 20,
    "ipBanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ipFirewallBanAfter" INTEGER NOT NULL DEFAULT 30,
    "maxFailuresBeforeAuthDisable" INTEGER NOT NULL DEFAULT 200,
    "authCircuitMinutes" INTEGER NOT NULL DEFAULT 30,
    "authDisabledUntil" TIMESTAMP(3),
    "windowMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_abuse_settings_pkey" PRIMARY KEY ("id")
);
