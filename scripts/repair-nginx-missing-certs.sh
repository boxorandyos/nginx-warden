#!/bin/bash
################################################################################
# Disable nginx site configs that reference missing SSL certificate files.
# Safe to run repeatedly. Used by update.sh / deploy so nginx -t can succeed
# after a certificate was deleted without regenerating the site config.
################################################################################
set -euo pipefail

SITES_ENABLED="${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
LOG_PREFIX="[repair-nginx-missing-certs]"

if [[ ! -d "$SITES_ENABLED" ]]; then
  echo "${LOG_PREFIX} No sites-enabled dir at ${SITES_ENABLED}; nothing to do"
  exit 0
fi

repaired=0
shopt -s nullglob
for conf in "${SITES_ENABLED}"/*.conf; do
  [[ -e "$conf" ]] || continue
  # Collect ssl_certificate / ssl_certificate_key paths (ignore comments)
  missing=0
  while IFS= read -r cert_path; do
    [[ -z "$cert_path" ]] && continue
    # Strip trailing semicolon / quotes if any slipped through
    cert_path="${cert_path%;}"
    cert_path="${cert_path#\"}"
    cert_path="${cert_path%\"}"
    if [[ ! -f "$cert_path" ]]; then
      echo "${LOG_PREFIX} Missing cert file for $(basename "$conf"): ${cert_path}"
      missing=1
      break
    fi
  done < <(grep -E '^\s*ssl_certificate(_key)?\s+' "$conf" 2>/dev/null | grep -v '^\s*#' | awk '{print $2}' | tr -d ';' || true)

  if [[ "$missing" -eq 1 ]]; then
    disabled="${conf}.disabled-missing-cert-$(date +%Y%m%d%H%M%S)"
    # Prefer renaming the enabled entry so nginx stops loading it immediately
    if [[ -L "$conf" ]]; then
      rm -f "$conf"
      echo "${LOG_PREFIX} Removed symlink $(basename "$conf") (target still in sites-available)"
    else
      mv "$conf" "$disabled"
      echo "${LOG_PREFIX} Moved $(basename "$conf") -> $(basename "$disabled")"
    fi
    repaired=$((repaired + 1))
  fi
done

if [[ "$repaired" -gt 0 ]]; then
  echo "${LOG_PREFIX} Disabled ${repaired} site config(s) that referenced missing certificate files"
else
  echo "${LOG_PREFIX} No missing-certificate site configs found"
fi

exit 0
