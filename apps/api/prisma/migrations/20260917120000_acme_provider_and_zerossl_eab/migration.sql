-- ACME provider per certificate + ZeroSSL EAB / default CA on system config

CREATE TYPE "AcmeProvider" AS ENUM ('letsencrypt', 'zerossl');

ALTER TABLE "ssl_certificates" ADD COLUMN "acmeProvider" "AcmeProvider";

ALTER TABLE "system_configs" ADD COLUMN "acmeDefaultProvider" "AcmeProvider" NOT NULL DEFAULT 'letsencrypt';
ALTER TABLE "system_configs" ADD COLUMN "zerosslEabKid" TEXT;
ALTER TABLE "system_configs" ADD COLUMN "zerosslEabHmacKey" TEXT;
