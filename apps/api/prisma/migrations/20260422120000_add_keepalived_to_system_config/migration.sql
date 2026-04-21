-- VRRP / Keepalived high availability (configured on master; synced to slaves)
ALTER TABLE "system_configs" ADD COLUMN "keepalivedEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedVirtualIp" TEXT;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedVrrpInterface" TEXT;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedRouterId" INTEGER NOT NULL DEFAULT 51;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedAuthPass" TEXT;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedPriorityMaster" INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "system_configs" ADD COLUMN "keepalivedPriorityBackup" INTEGER NOT NULL DEFAULT 100;
