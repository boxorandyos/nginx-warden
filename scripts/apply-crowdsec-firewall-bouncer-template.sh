#!/usr/bin/env bash
# Apply scripts/templates/crowdsec-firewall-bouncer.yaml to the host bouncer config (with backup).
# Usage (root):
#   sudo CROWDSEC_BOUNCER_API_KEY='...' ./scripts/apply-crowdsec-firewall-bouncer-template.sh
# Or set the key after copy: edit /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml and restart the bouncer.

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC="${REPO_ROOT}/scripts/templates/crowdsec-firewall-bouncer.yaml"
DST="${CROWDSEC_BOUNCER_YML:-/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml}"

if [[ ! -f "$SRC" ]]; then
  echo "Missing template: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DST")"

if [[ -f "$DST" ]]; then
  BAK="${DST}.warden-backup.$(date +%Y%m%d%H%M%S)"
  cp -a "$DST" "$BAK"
  echo "Backed up existing config to $BAK"
fi

cp "$SRC" "$DST"
LAPI_PORT="${CROWDSEC_LAPI_PORT:-9091}"
sed -i -E "s|^([[:space:]]*api_url:[[:space:]]*)http://127\\.0\\.0\\.1:[0-9]+/|\1http://127.0.0.1:${LAPI_PORT}/|" "$DST"
echo "Installed template -> $DST (api_url -> 127.0.0.1:${LAPI_PORT}, override with CROWDSEC_LAPI_PORT=...)"

if [[ -n "${CROWDSEC_BOUNCER_API_KEY:-}" ]]; then
  export _WARDEN_BOUNCER_DST="$DST"
  python3 -c "
import os, pathlib
p = pathlib.Path(os.environ['_WARDEN_BOUNCER_DST'])
k = os.environ.get('CROWDSEC_BOUNCER_API_KEY', '')
text = p.read_text(encoding='utf-8')
p.write_text(text.replace('REPLACE_WITH_CSCLI_BOUNCER_KEY', k), encoding='utf-8')
"
  echo "Inserted CROWDSEC_BOUNCER_API_KEY into config."
else
  echo "Set api_key in $DST (e.g. from: cscli bouncers add -n warden-firewall) then restart the bouncer."
fi

for unit in crowdsec-firewall-bouncer cs-firewall-bouncer; do
  if systemctl is-enabled "$unit" &>/dev/null || systemctl cat "$unit" &>/dev/null; then
    if systemctl restart "$unit" 2>/dev/null; then
      echo "Restarted $unit"
    else
      echo "Note: could not restart $unit (may still be running with old config)." >&2
    fi
    break
  fi
done
