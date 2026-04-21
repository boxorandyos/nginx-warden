-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "jti" TEXT;

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_jti_idx" ON "refresh_tokens"("userId", "jti");
