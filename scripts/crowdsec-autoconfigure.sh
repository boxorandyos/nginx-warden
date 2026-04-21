#!/usr/bin/env bash
# Create CrowdSec LAPI bouncer keys, write apps/api/.env, apply nftables bouncer template, restart services.
# Intended to run as root after scripts/install-crowdsec.sh (e.g. from deploy.sh).
#
# Required env: BACKEND_DIR, PROJECT_DIR
# Optional: CROWDSEC_LAPI_PORT (default 9091)

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

BACKEND_DIR="${BACKEND_DIR:?Set BACKEND_DIR to apps/api absolute path}"
PROJECT_DIR="${PROJECT_DIR:?Set PROJECT_DIR to repo root}"
CROWDSEC_LAPI_PORT="${CROWDSEC_LAPI_PORT:-9091}"
LAPI_URL="http://127.0.0.1:${CROWDSEC_LAPI_PORT}"

ENV_FILE="${BACKEND_DIR}/.env"
BOUNCER_API_NAME="nginx-warden-api"
BOUNCER_FW_NAME="warden-firewall"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v cscli >/dev/null 2>&1; then
  echo "cscli not found — install CrowdSec first (scripts/install-crowdsec.sh)." >&2
  exit 1
fi

log() { echo "[crowdsec-autoconfigure] $*"; }

# Wait until cscli can talk to LAPI
for _ in $(seq 1 60); do
  if cscli version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! cscli version >/dev/null 2>&1; then
  echo "CrowdSec LAPI not reachable via cscli after wait; check crowdsec.service and ${LAPI_URL}" >&2
  exit 1
fi

delete_bouncer_if_exists() {
  local n="$1"
  # Older cscli may not support --ignore-missing; missing bouncer is non-fatal
  cscli bouncers delete "$n" --ignore-missing 2>/dev/null || cscli bouncers delete "$n" 2>/dev/null || true
}

log "Registering LAPI bouncers: ${BOUNCER_API_NAME}, ${BOUNCER_FW_NAME}"
delete_bouncer_if_exists "$BOUNCER_API_NAME"
delete_bouncer_if_exists "$BOUNCER_FW_NAME"

API_KEY=""
for _ in $(seq 1 20); do
  out=$(cscli bouncers add "$BOUNCER_API_NAME" -o raw 2>&1 || true)
  API_KEY=$(echo "${out}" | head -1 | tr -d '\n\r')
  [[ -n "${API_KEY}" ]] && break
  sleep 2
done
if [[ -z "${API_KEY}" ]]; then
  echo "Failed to create bouncer ${BOUNCER_API_NAME}" >&2
  exit 1
fi

FW_KEY=""
for _ in $(seq 1 20); do
  out=$(cscli bouncers add "$BOUNCER_FW_NAME" -o raw 2>&1 || true)
  FW_KEY=$(echo "${out}" | head -1 | tr -d '\n\r')
  [[ -n "${FW_KEY}" ]] && break
  sleep 2
done
if [[ -z "${FW_KEY}" ]]; then
  echo "Failed to create bouncer ${BOUNCER_FW_NAME}" >&2
  exit 1
fi

log "Updating ${ENV_FILE} (CrowdSec variables)"
cp -a "$ENV_FILE" "${ENV_FILE}.bak-crowdsec-$(date +%Y%m%d%H%M%S)"
export _WARDEN_ENV_FILE="$ENV_FILE"
export _WARDEN_LAPI_URL="$LAPI_URL"
export _WARDEN_API_KEY="$API_KEY"
python3 <<'PY'
import os
import pathlib
import re

p = pathlib.Path(os.environ["_WARDEN_ENV_FILE"])
lapi = os.environ["_WARDEN_LAPI_URL"]
key = os.environ["_WARDEN_API_KEY"]
text = p.read_text(encoding="utf-8")
out = []
for line in text.splitlines():
    if re.match(r"^\s*#?\s*CROWDSEC_LAPI_URL\s*=", line):
        continue
    if re.match(r"^\s*#?\s*CROWDSEC_API_KEY\s*=", line):
        continue
    if re.match(r"^\s*#\s*CrowdSec LAPI\b", line):
        continue
    out.append(line)
while out and out[-1] == "":
    out.pop()
out.append("")
out.append("# CrowdSec — auto-configured by scripts/crowdsec-autoconfigure.sh")
out.append(f'CROWDSEC_LAPI_URL="{lapi}"')
out.append(f'CROWDSEC_API_KEY="{key}"')
p.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

CRED="/root/.nginx-warden-credentials"
if [[ -f "$CRED" ]] && ! grep -q 'CrowdSec (auto-configured)' "$CRED" 2>/dev/null; then
  {
    echo ""
    echo "## CrowdSec (auto-configured)"
    echo "CROWDSEC_LAPI_URL=${LAPI_URL}"
    echo "CROWDSEC_API_KEY (UI / API probe)=${API_KEY}"
    echo "CROWDSEC_FIREWALL_BOUNCER_KEY=${FW_KEY}"
  } >> "$CRED"
  chmod 600 "$CRED"
  log "Appended CrowdSec keys to ${CRED}"
fi

log "Applying firewall bouncer template"
export CROWDSEC_BOUNCER_API_KEY="${FW_KEY}"
export CROWDSEC_LAPI_PORT
bash "${PROJECT_DIR}/scripts/apply-crowdsec-firewall-bouncer-template.sh"

if systemctl is-enabled nginx-warden-backend.service &>/dev/null || systemctl cat nginx-warden-backend.service &>/dev/null; then
  log "Restarting nginx-warden-backend to load CROWDSEC_* from .env"
  systemctl restart nginx-warden-backend.service || true
  sleep 2
fi

log "Done."
