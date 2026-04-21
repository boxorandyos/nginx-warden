-- CreateEnum
CREATE TYPE "FirewallSetKind" AS ENUM ('trusted_ipv4', 'trusted_ipv6', 'local_deny_ipv4', 'local_deny_ipv6');

-- CreateTable
CREATE TABLE "firewall_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "apiPort" INTEGER NOT NULL DEFAULT 3001,
    "uiPort" INTEGER NOT NULL DEFAULT 8088,
    "publicTcpPorts" INTEGER[] DEFAULT ARRAY[80, 443]::INTEGER[],
    "crowdsecNftSetV4" TEXT NOT NULL DEFAULT 'crowdsec_blacklists',
    "crowdsecNftSetV6" TEXT NOT NULL DEFAULT 'crowdsec6_blacklists',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firewall_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firewall_address_entries" (
    "id" TEXT NOT NULL,
    "kind" "FirewallSetKind" NOT NULL,
    "cidr" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firewall_address_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firewall_apply_logs" (
    "id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "rulesetSnippet" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firewall_apply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "firewall_address_entries_kind_idx" ON "firewall_address_entries"("kind");

-- CreateIndex
CREATE INDEX "firewall_apply_logs_appliedAt_idx" ON "firewall_apply_logs"("appliedAt");

INSERT INTO "firewall_settings" ("id", "enabled", "sshPort", "apiPort", "uiPort", "publicTcpPorts", "crowdsecNftSetV4", "crowdsecNftSetV6", "updatedAt")
VALUES ('default', false, 22, 3001, 8080, ARRAY[80, 443]::INTEGER[], 'crowdsec_blacklists', 'crowdsec6_blacklists', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
