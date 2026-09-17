#!/bin/bash
################################################################################
# Rewrite deprecated `listen 443 ssl http2;` → `listen 443 ssl;` + `http2 on;`
# when installed nginx is ≥ 1.25.1. No-op on older nginx or already-migrated files.
################################################################################
set -euo pipefail

SITES_DIR="${1:-/etc/nginx/sites-available}"

nginx_prefers_http2_directive() {
  local ver
  ver="$(nginx -v 2>&1 || true)"
  if [[ "$ver" =~ nginx/([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    local major="${BASH_REMATCH[1]}"
    local minor="${BASH_REMATCH[2]}"
    local patch="${BASH_REMATCH[3]}"
    if (( major > 1 )); then return 0; fi
    if (( major < 1 )); then return 1; fi
    if (( minor > 25 )); then return 0; fi
    if (( minor < 25 )); then return 1; fi
    (( patch >= 1 ))
    return $?
  fi
  return 1
}

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx not found — skip http2 migrate"
  exit 0
fi

if ! nginx_prefers_http2_directive; then
  echo "nginx does not prefer http2 on; — skip migrate"
  exit 0
fi

if [ ! -d "$SITES_DIR" ]; then
  echo "No sites dir at $SITES_DIR — skip"
  exit 0
fi

changed=0
shopt -s nullglob
for conf in "$SITES_DIR"/*.conf; do
  if grep -qE 'listen[[:space:]]+443[[:space:]]+ssl[[:space:]]+http2[[:space:]]*;' "$conf" 2>/dev/null; then
    # Insert http2 on; on the following line, then strip http2 from listen
    sed -i -E \
      -e '/listen[[:space:]]+443[[:space:]]+ssl[[:space:]]+http2[[:space:]]*;/a\    http2 on;' \
      -e 's/listen([[:space:]]+)443([[:space:]]+)ssl[[:space:]]+http2([[:space:]]*);/listen\1443\2ssl;/' \
      "$conf"
    changed=$((changed + 1))
  fi
done

# Also rewrite sites-enabled copies that are real files (not symlinks)
ENABLED_DIR="/etc/nginx/sites-enabled"
if [ -d "$ENABLED_DIR" ] && [ "$SITES_DIR" != "$ENABLED_DIR" ]; then
  for conf in "$ENABLED_DIR"/*.conf; do
    [ -e "$conf" ] || continue
    if [ -L "$conf" ]; then
      continue
    fi
    if grep -qE 'listen[[:space:]]+443[[:space:]]+ssl[[:space:]]+http2[[:space:]]*;' "$conf" 2>/dev/null; then
      sed -i -E \
        -e '/listen[[:space:]]+443[[:space:]]+ssl[[:space:]]+http2[[:space:]]*;/a\    http2 on;' \
        -e 's/listen([[:space:]]+)443([[:space:]]+)ssl[[:space:]]+http2([[:space:]]*);/listen\1443\2ssl;/' \
        "$conf"
      changed=$((changed + 1))
    fi
  done
fi

echo "Migrated http2 listen syntax in ${changed} site config(s)"
exit 0
