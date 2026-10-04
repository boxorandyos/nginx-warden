#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACTS_DIR="${1:-${ROOT_DIR}/artifacts/readiness}"
mkdir -p "${ARTIFACTS_DIR}"

PASS=0
WARN=0
FAIL=0

report() {
  local status="$1"
  local label="$2"
  local detail="$3"
  printf "%-5s %-35s %s\n" "${status}" "${label}" "${detail}"
}

run_check() {
  local label="$1"
  local command="$2"
  local logfile="$3"
  if bash -lc "${command}" >"${logfile}" 2>&1; then
    report "PASS" "${label}" "ok"
    PASS=$((PASS + 1))
  else
    report "FAIL" "${label}" "see ${logfile}"
    FAIL=$((FAIL + 1))
  fi
}

report "INFO" "Artifacts" "${ARTIFACTS_DIR}"

run_check "API unit tests" "cd '${ROOT_DIR}/apps/api' && pnpm test" "${ARTIFACTS_DIR}/api-test.log"
run_check "Web build" "cd '${ROOT_DIR}/apps/web' && pnpm build" "${ARTIFACTS_DIR}/web-build.log"
run_check "API build" "cd '${ROOT_DIR}/apps/api' && pnpm build" "${ARTIFACTS_DIR}/api-build.log"

if [[ -n "${STAGING_API_BASE_URL:-}" && -n "${STAGING_BEARER_TOKEN:-}" ]]; then
  if curl -fsS -H "Authorization: Bearer ${STAGING_BEARER_TOKEN}" "${STAGING_API_BASE_URL}/api/health" \
    >"${ARTIFACTS_DIR}/staging-health.log" 2>&1; then
    report "PASS" "Staging health probe" "reachable"
    PASS=$((PASS + 1))
  else
    report "FAIL" "Staging health probe" "see ${ARTIFACTS_DIR}/staging-health.log"
    FAIL=$((FAIL + 1))
  fi
else
  report "WARN" "Staging health probe" "STAGING_API_BASE_URL or STAGING_BEARER_TOKEN missing"
  WARN=$((WARN + 1))
fi

echo
echo "Summary: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
if (( FAIL > 0 )); then
  echo "GO/NO-GO: NO-GO"
  exit 2
fi
if (( WARN > 0 )); then
  echo "GO/NO-GO: CONDITIONAL"
  exit 0
fi
echo "GO/NO-GO: GO"
