-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN "portalAccessOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
