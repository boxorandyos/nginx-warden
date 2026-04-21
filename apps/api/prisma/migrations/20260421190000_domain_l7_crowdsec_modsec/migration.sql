-- CreateEnum
CREATE TYPE "ModsecEngineMode" AS ENUM ('On', 'DetectionOnly');

-- AlterTable
ALTER TABLE "domains" ADD COLUMN "limitReqPerMinute" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "domains" ADD COLUMN "limitReqBurst" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "domains" ADD COLUMN "limitConnPerAddr" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "domains" ADD COLUMN "modsecEngineMode" "ModsecEngineMode" NOT NULL DEFAULT 'On';
ALTER TABLE "domains" ADD COLUMN "crowdsecNginxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "domains" ADD COLUMN "crowdsecAppsecEnabled" BOOLEAN NOT NULL DEFAULT false;
