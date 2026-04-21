#!/usr/bin/env bash
# Optional: install CrowdSec engine + nftables firewall bouncer on Debian/Ubuntu.
# Align bouncer set names with Fleet → Firewall (defaults: crowdsec_blacklists / crowdsec6_blacklists).
#
# Local API port: default 9091 (not 8080) to avoid clashes with other services.
# Override: sudo CROWDSEC_LAPI_PORT=9081 ./scripts/install-crowdsec.sh

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

CROWDSEC_LAPI_PORT="${CROWDSEC_LAPI_PORT:-9091}"
export DEBIAN_FRONTEND=noninteractive

patch_crowdsec_lapi_port() {
  local port="$1"
  local cfg="/etc/crowdsec/config.yaml"
  local cred="/etc/crowdsec/local_api_credentials.yaml"

  if [[ ! -f "$cfg" ]]; then
    echo "Expected CrowdSec config not found: $cfg" >&2
    return 1
  fi

  cp -a "$cfg" "${cfg}.bak-warden-$(date +%Y%m%d%H%M%S)"
  # Bind LAPI on loopback with chosen port (replaces any previous listen_uri value)
  sed -i -E "s|^([[:space:]]*listen_uri:[[:space:]]+).*$|\1127.0.0.1:${port}|" "$cfg"

  if [[ -f "$cred" ]]; then
    cp -a "$cred" "${cred}.bak-warden-$(date +%Y%m%d%H%M%S)"
    sed -i -E "s|^([[:space:]]*url:[[:space:]]+)http://127\\.0\\.0\\.1:[0-9]+|\1http://127.0.0.1:${port}|" "$cred"
  else
    echo "Note: $cred not found yet; if cscli fails to connect, add url: http://127.0.0.1:${port} there." >&2
  fi
}

patch_bouncer_api_url() {
  local port="$1"
  local f="$2"
  [[ -f "$f" ]] || return 0
  cp -a "$f" "${f}.bak-warden-$(date +%Y%m%d%H%M%S)"
  sed -i -E "s|^([[:space:]]*api_url:[[:space:]]*)http://127\\.0\\.0\\.1:[0-9]+/|\1http://127.0.0.1:${port}/|" "$f"
}

merge_ports_env() {
  local port="$1"
  local pe="/etc/nginx-warden/ports.env"
  mkdir -p /etc/nginx-warden
  if [[ -f "$pe" ]] && grep -q '^CROWDSEC_LAPI_PORT=' "$pe" 2>/dev/null; then
    sed -i "s/^CROWDSEC_LAPI_PORT=.*/CROWDSEC_LAPI_PORT=${port}/" "$pe"
  else
    echo "CROWDSEC_LAPI_PORT=${port}" >> "$pe"
  fi
  chmod 644 "$pe" 2>/dev/null || true
}

apt-get update -y
apt-get install -y crowdsec

# Stop before editing so the first start uses the new listen_uri / credentials URL
systemctl stop crowdsec 2>/dev/null || true

patch_crowdsec_lapi_port "${CROWDSEC_LAPI_PORT}"

# Firewall bouncer (nftables; set names must match Warden Fleet → Firewall)
if ! apt-get install -y crowdsec-firewall-bouncer; then
  apt-get install -y crowdsec-firewall-bouncer-nftables || apt-get install -y crowdsec-firewall-bouncer-iptables
fi

BOUNCER_YML="/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml"
patch_bouncer_api_url "${CROWDSEC_LAPI_PORT}" "${BOUNCER_YML}"

if [[ -f "$BOUNCER_YML" ]]; then
  echo "Found $BOUNCER_YML — merge with scripts/templates/crowdsec-firewall-bouncer.yaml:"
  echo "  mode: nftables, set-only, table nginx_warden_filter, sets crowdsec_blacklists / crowdsec6_blacklists"
fi

merge_ports_env "${CROWDSEC_LAPI_PORT}"

systemctl enable --now crowdsec || true
# Unit name varies by package (cs-firewall-bouncer / crowdsec-firewall-bouncer)
systemctl enable --now crowdsec-firewall-bouncer 2>/dev/null || systemctl enable --now cs-firewall-bouncer 2>/dev/null || true

# Baseline scenario: Linux firewall / system (ignore errors offline)
if command -v cscli >/dev/null 2>&1; then
  cscli hub update 2>/dev/null || true
  cscli collections install crowdsecurity/linux -y 2>/dev/null || true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/templates/crowdsec-firewall-bouncer.yaml"
if [[ -f "${BOUNCER_YML}" ]] && [[ -f "${TEMPLATE}" ]]; then
  echo "Merge ${TEMPLATE} into ${BOUNCER_YML} (set-only, table nginx_warden_filter, Warden set names)."
fi

echo "CrowdSec Local API: http://127.0.0.1:${CROWDSEC_LAPI_PORT}/ (override with CROWDSEC_LAPI_PORT=...)"
echo "Done. Run: cscli version && cscli bouncers list"
echo "From deploy.sh, scripts/crowdsec-autoconfigure.sh runs next: LAPI keys → apps/api/.env + firewall bouncer template."
