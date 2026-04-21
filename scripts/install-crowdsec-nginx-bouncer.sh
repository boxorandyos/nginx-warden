#!/usr/bin/env bash
# Optional: CrowdSec nginx bouncer (Lua). Requires nginx with lua-nginx-module (e.g. OpenResty) or a
# distro package that wires Lua + crowdsec into nginx. After install, set ENABLE_CROWDSEC_NGINX_LUA=true
# on the Nginx Warden API and enable "CrowdSec L7" on domains in the UI.

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y

INSTALLED=0
for pkg in crowdsec-nginx-bouncer cs-nginx-bouncer; do
  if apt-get install -y "$pkg" 2>/dev/null; then
    INSTALLED=1
    echo "Installed package: $pkg"
    break
  fi
done

if [[ "$INSTALLED" -ne 1 ]]; then
  echo "No nginx bouncer package found (tried crowdsec-nginx-bouncer, cs-nginx-bouncer)." >&2
  echo "Build from https://github.com/crowdsecurity/cs-nginx-bouncer or use OpenResty + upstream docs." >&2
  exit 1
fi

if command -v cscli >/dev/null 2>&1; then
  cscli hub update 2>/dev/null || true
  cscli collections install crowdsecurity/nginx -y 2>/dev/null || true
fi

echo "Follow https://docs.crowdsec.net/u/bouncers/nginx/ to add lua_package_path / init in http {}."
echo "Then set ENABLE_CROWDSEC_NGINX_LUA=true in apps/api/.env and reload the API."
