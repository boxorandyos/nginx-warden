-- Align default UI port with production deploy (WARDEN_UI_PORT=8088).
-- Existing rows are unchanged; new rows use the new default.
ALTER TABLE "firewall_settings" ALTER COLUMN "uiPort" SET DEFAULT 8088;
