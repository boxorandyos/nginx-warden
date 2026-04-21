-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'moderator', 'viewer');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('login', 'logout', 'config_change', 'user_action', 'security', 'system');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('active', 'inactive', 'error');

-- CreateEnum
CREATE TYPE "UpstreamStatus" AS ENUM ('up', 'down', 'checking');

-- CreateEnum
CREATE TYPE "LoadBalancerAlgorithm" AS ENUM ('round_robin', 'least_conn', 'ip_hash');

-- CreateEnum
CREATE TYPE "SSLStatus" AS ENUM ('valid', 'expiring', 'expired');

-- CreateEnum
CREATE TYPE "ModsecEngineMode" AS ENUM ('On', 'DetectionOnly');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('email', 'telegram');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "AclType" AS ENUM ('whitelist', 'blacklist');

-- CreateEnum
CREATE TYPE "AclField" AS ENUM ('ip', 'geoip', 'user_agent', 'url', 'method', 'header');

-- CreateEnum
CREATE TYPE "AclOperator" AS ENUM ('equals', 'contains', 'regex');

-- CreateEnum
CREATE TYPE "AclAction" AS ENUM ('allow', 'deny', 'challenge');

-- CreateEnum
CREATE TYPE "AccessListType" AS ENUM ('ip_whitelist', 'http_basic_auth', 'combined');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('success', 'failed', 'running', 'pending');

-- CreateEnum
CREATE TYPE "SlaveNodeStatus" AS ENUM ('online', 'offline', 'syncing', 'error');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('success', 'failed', 'partial', 'running');

-- CreateEnum
CREATE TYPE "SyncLogType" AS ENUM ('full_sync', 'incremental_sync', 'health_check');

-- CreateEnum
CREATE TYPE "NodeMode" AS ENUM ('master', 'slave');

-- CreateEnum
CREATE TYPE "NLBStatus" AS ENUM ('active', 'inactive', 'error');

-- CreateEnum
CREATE TYPE "NLBProtocol" AS ENUM ('tcp', 'udp', 'tcp_udp');

-- CreateEnum
CREATE TYPE "NLBAlgorithm" AS ENUM ('round_robin', 'least_conn', 'ip_hash', 'hash');

-- CreateEnum
CREATE TYPE "NLBUpstreamStatus" AS ENUM ('up', 'down', 'checking');

-- CreateEnum
CREATE TYPE "FirewallSetKind" AS ENUM ('trusted_ipv4', 'trusted_ipv6', 'local_deny_ipv4', 'local_deny_ipv6');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "avatar" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "language" TEXT NOT NULL DEFAULT 'en',
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT NOT NULL DEFAULT 'totp',
    "secret" TEXT,
    "backupCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "details" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT,
    "location" TEXT,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'inactive',
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sslExpiry" TIMESTAMP(3),
    "modsecEnabled" BOOLEAN NOT NULL DEFAULT true,
    "realIpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "realIpCloudflare" BOOLEAN NOT NULL DEFAULT false,
    "realIpCustomCidrs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hstsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "http2Enabled" BOOLEAN NOT NULL DEFAULT true,
    "grpcEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clientMaxBodySize" INTEGER DEFAULT 100,
    "customLocations" JSONB,
    "limitReqPerMinute" INTEGER NOT NULL DEFAULT 0,
    "limitReqBurst" INTEGER NOT NULL DEFAULT 20,
    "limitConnPerAddr" INTEGER NOT NULL DEFAULT 0,
    "modsecEngineMode" "ModsecEngineMode" NOT NULL DEFAULT 'On',
    "crowdsecNginxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "crowdsecAppsecEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upstreams" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'http',
    "sslVerify" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "maxFails" INTEGER NOT NULL DEFAULT 3,
    "failTimeout" INTEGER NOT NULL DEFAULT 10,
    "status" "UpstreamStatus" NOT NULL DEFAULT 'checking',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upstreams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_balancer_configs" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "algorithm" "LoadBalancerAlgorithm" NOT NULL DEFAULT 'round_robin',
    "healthCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 30,
    "healthCheckTimeout" INTEGER NOT NULL DEFAULT 5,
    "healthCheckPath" TEXT NOT NULL DEFAULT '/',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_balancer_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssl_certificates" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "sans" TEXT[],
    "issuer" TEXT NOT NULL,
    "subject" TEXT,
    "certificate" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "chain" TEXT,
    "subjectDetails" JSONB,
    "issuerDetails" JSONB,
    "serialNumber" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "status" "SSLStatus" NOT NULL DEFAULT 'valid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssl_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modsec_crs_rules" (
    "id" TEXT NOT NULL,
    "domainId" TEXT,
    "ruleFile" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "paranoia" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modsec_crs_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modsec_rules" (
    "id" TEXT NOT NULL,
    "domainId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ruleContent" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modsec_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nginx_configs" (
    "id" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nginx_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_status" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "step" TEXT,
    "message" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NotificationChannelType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkInterval" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule_channels" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rule_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acl_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AclType" NOT NULL,
    "conditionField" "AclField" NOT NULL,
    "conditionOperator" "AclOperator" NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "action" "AclAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acl_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AccessListType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_list_auth_users" (
    "id" TEXT NOT NULL,
    "accessListId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_list_auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_list_domains" (
    "id" TEXT NOT NULL,
    "accessListId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_list_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseTime" DOUBLE PRECISION NOT NULL,
    "throughput" DOUBLE PRECISION NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "status" "BackupStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_files" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'success',
    "type" TEXT NOT NULL DEFAULT 'full',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 3001,
    "apiKey" TEXT NOT NULL,
    "status" "SlaveNodeStatus" NOT NULL DEFAULT 'offline',
    "lastSeen" TIMESTAMP(3),
    "version" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "configHash" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "latency" INTEGER,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slave_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "nodeMode" "NodeMode" NOT NULL DEFAULT 'master',
    "masterApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "slaveApiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "masterHost" TEXT,
    "masterPort" INTEGER,
    "masterApiKey" TEXT,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "lastSyncHash" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnectedAt" TIMESTAMP(3),
    "connectionError" TEXT,
    "portalAccessOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "SyncLogType" NOT NULL,
    "status" "SyncLogStatus" NOT NULL DEFAULT 'running',
    "configHash" TEXT,
    "changesCount" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_versions" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "configHash" TEXT NOT NULL,
    "configData" JSONB NOT NULL,
    "createdBy" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_load_balancers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "port" INTEGER NOT NULL,
    "protocol" "NLBProtocol" NOT NULL DEFAULT 'tcp',
    "algorithm" "NLBAlgorithm" NOT NULL DEFAULT 'round_robin',
    "status" "NLBStatus" NOT NULL DEFAULT 'inactive',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "proxyTimeout" INTEGER NOT NULL DEFAULT 3,
    "proxyConnectTimeout" INTEGER NOT NULL DEFAULT 1,
    "proxyNextUpstream" BOOLEAN NOT NULL DEFAULT true,
    "proxyNextUpstreamTimeout" INTEGER NOT NULL DEFAULT 0,
    "proxyNextUpstreamTries" INTEGER NOT NULL DEFAULT 0,
    "healthCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 10,
    "healthCheckTimeout" INTEGER NOT NULL DEFAULT 5,
    "healthCheckRises" INTEGER NOT NULL DEFAULT 2,
    "healthCheckFalls" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_load_balancers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlb_upstreams" (
    "id" TEXT NOT NULL,
    "nlbId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "maxFails" INTEGER NOT NULL DEFAULT 3,
    "failTimeout" INTEGER NOT NULL DEFAULT 10,
    "maxConns" INTEGER NOT NULL DEFAULT 0,
    "backup" BOOLEAN NOT NULL DEFAULT false,
    "down" BOOLEAN NOT NULL DEFAULT false,
    "status" "NLBUpstreamStatus" NOT NULL DEFAULT 'checking',
    "lastCheck" TIMESTAMP(3),
    "lastError" TEXT,
    "responseTime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlb_upstreams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlb_health_checks" (
    "id" TEXT NOT NULL,
    "nlbId" TEXT NOT NULL,
    "upstreamHost" TEXT NOT NULL,
    "upstreamPort" INTEGER NOT NULL,
    "status" "NLBUpstreamStatus" NOT NULL,
    "responseTime" DOUBLE PRECISION,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nlb_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firewall_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
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
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auth_userId_key" ON "two_factor_auth"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_timestamp_idx" ON "activity_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "activity_logs_type_timestamp_idx" ON "activity_logs"("type", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_jti_idx" ON "refresh_tokens"("userId", "jti");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionId_key" ON "user_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_sessionId_idx" ON "user_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE INDEX "domains_name_idx" ON "domains"("name");

-- CreateIndex
CREATE INDEX "domains_status_idx" ON "domains"("status");

-- CreateIndex
CREATE INDEX "upstreams_domainId_idx" ON "upstreams"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "load_balancer_configs_domainId_key" ON "load_balancer_configs"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "ssl_certificates_domainId_key" ON "ssl_certificates"("domainId");

-- CreateIndex
CREATE INDEX "ssl_certificates_domainId_idx" ON "ssl_certificates"("domainId");

-- CreateIndex
CREATE INDEX "ssl_certificates_validTo_idx" ON "ssl_certificates"("validTo");

-- CreateIndex
CREATE INDEX "modsec_crs_rules_domainId_idx" ON "modsec_crs_rules"("domainId");

-- CreateIndex
CREATE INDEX "modsec_crs_rules_category_idx" ON "modsec_crs_rules"("category");

-- CreateIndex
CREATE UNIQUE INDEX "modsec_crs_rules_ruleFile_domainId_key" ON "modsec_crs_rules"("ruleFile", "domainId");

-- CreateIndex
CREATE INDEX "modsec_rules_domainId_idx" ON "modsec_rules"("domainId");

-- CreateIndex
CREATE INDEX "modsec_rules_category_idx" ON "modsec_rules"("category");

-- CreateIndex
CREATE INDEX "nginx_configs_configType_idx" ON "nginx_configs"("configType");

-- CreateIndex
CREATE UNIQUE INDEX "installation_status_component_key" ON "installation_status"("component");

-- CreateIndex
CREATE INDEX "alert_rule_channels_ruleId_idx" ON "alert_rule_channels"("ruleId");

-- CreateIndex
CREATE INDEX "alert_rule_channels_channelId_idx" ON "alert_rule_channels"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rule_channels_ruleId_channelId_key" ON "alert_rule_channels"("ruleId", "channelId");

-- CreateIndex
CREATE INDEX "alert_history_severity_idx" ON "alert_history"("severity");

-- CreateIndex
CREATE INDEX "alert_history_acknowledged_idx" ON "alert_history"("acknowledged");

-- CreateIndex
CREATE INDEX "alert_history_timestamp_idx" ON "alert_history"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "access_lists_name_key" ON "access_lists"("name");

-- CreateIndex
CREATE INDEX "access_lists_type_idx" ON "access_lists"("type");

-- CreateIndex
CREATE INDEX "access_lists_enabled_idx" ON "access_lists"("enabled");

-- CreateIndex
CREATE INDEX "access_list_auth_users_accessListId_idx" ON "access_list_auth_users"("accessListId");

-- CreateIndex
CREATE UNIQUE INDEX "access_list_auth_users_accessListId_username_key" ON "access_list_auth_users"("accessListId", "username");

-- CreateIndex
CREATE INDEX "access_list_domains_accessListId_idx" ON "access_list_domains"("accessListId");

-- CreateIndex
CREATE INDEX "access_list_domains_domainId_idx" ON "access_list_domains"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "access_list_domains_accessListId_domainId_key" ON "access_list_domains"("accessListId", "domainId");

-- CreateIndex
CREATE INDEX "performance_metrics_domain_timestamp_idx" ON "performance_metrics"("domain", "timestamp");

-- CreateIndex
CREATE INDEX "performance_metrics_timestamp_idx" ON "performance_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "backup_files_scheduleId_idx" ON "backup_files"("scheduleId");

-- CreateIndex
CREATE INDEX "backup_files_createdAt_idx" ON "backup_files"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "slave_nodes_name_key" ON "slave_nodes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "slave_nodes_apiKey_key" ON "slave_nodes"("apiKey");

-- CreateIndex
CREATE INDEX "slave_nodes_status_idx" ON "slave_nodes"("status");

-- CreateIndex
CREATE INDEX "slave_nodes_lastSeen_idx" ON "slave_nodes"("lastSeen");

-- CreateIndex
CREATE INDEX "sync_logs_nodeId_startedAt_idx" ON "sync_logs"("nodeId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "config_versions_configHash_key" ON "config_versions"("configHash");

-- CreateIndex
CREATE INDEX "config_versions_createdAt_idx" ON "config_versions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "network_load_balancers_name_key" ON "network_load_balancers"("name");

-- CreateIndex
CREATE INDEX "network_load_balancers_status_idx" ON "network_load_balancers"("status");

-- CreateIndex
CREATE INDEX "network_load_balancers_port_idx" ON "network_load_balancers"("port");

-- CreateIndex
CREATE INDEX "nlb_upstreams_nlbId_idx" ON "nlb_upstreams"("nlbId");

-- CreateIndex
CREATE INDEX "nlb_upstreams_status_idx" ON "nlb_upstreams"("status");

-- CreateIndex
CREATE INDEX "nlb_health_checks_nlbId_checkedAt_idx" ON "nlb_health_checks"("nlbId", "checkedAt");

-- CreateIndex
CREATE INDEX "nlb_health_checks_upstreamHost_upstreamPort_idx" ON "nlb_health_checks"("upstreamHost", "upstreamPort");

-- CreateIndex
CREATE INDEX "firewall_address_entries_kind_idx" ON "firewall_address_entries"("kind");

-- CreateIndex
CREATE INDEX "firewall_apply_logs_appliedAt_idx" ON "firewall_apply_logs"("appliedAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upstreams" ADD CONSTRAINT "upstreams_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_balancer_configs" ADD CONSTRAINT "load_balancer_configs_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssl_certificates" ADD CONSTRAINT "ssl_certificates_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modsec_crs_rules" ADD CONSTRAINT "modsec_crs_rules_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modsec_rules" ADD CONSTRAINT "modsec_rules_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_channels" ADD CONSTRAINT "alert_rule_channels_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_channels" ADD CONSTRAINT "alert_rule_channels_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "notification_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_list_auth_users" ADD CONSTRAINT "access_list_auth_users_accessListId_fkey" FOREIGN KEY ("accessListId") REFERENCES "access_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_list_domains" ADD CONSTRAINT "access_list_domains_accessListId_fkey" FOREIGN KEY ("accessListId") REFERENCES "access_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_list_domains" ADD CONSTRAINT "access_list_domains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_files" ADD CONSTRAINT "backup_files_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "backup_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "slave_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nlb_upstreams" ADD CONSTRAINT "nlb_upstreams_nlbId_fkey" FOREIGN KEY ("nlbId") REFERENCES "network_load_balancers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nlb_health_checks" ADD CONSTRAINT "nlb_health_checks_nlbId_fkey" FOREIGN KEY ("nlbId") REFERENCES "network_load_balancers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed default firewall settings row (required for UI / API)
INSERT INTO "firewall_settings" ("id", "enabled", "sshPort", "apiPort", "uiPort", "publicTcpPorts", "crowdsecNftSetV4", "crowdsecNftSetV6", "updatedAt")
VALUES ('default', false, 22, 3001, 8088, ARRAY[80, 443]::INTEGER[], 'crowdsec_blacklists', 'crowdsec6_blacklists', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
