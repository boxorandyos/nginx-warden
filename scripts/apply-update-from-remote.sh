#!/usr/bin/env bash
# Run from the API via detached spawn: git fetch/pull then scripts/update.sh.
# Must run as root (update.sh requires root). Not for manual use unless you know the implications.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="${NGINX_WARDEN_UI_UPDATE_LOG:-/var/log/nginx-warden-ui-update.log}"

REMOTE="${UPDATE_GIT_REMOTE:-origin}"
BRANCH="${UPDATE_GIT_BRANCH:-main}"
export GIT_TERMINAL_PROMPT=0

cd "$ROOT"

# Let the HTTP handler finish before we run git or touch systemd services.
sleep 2

{
  echo ""
  echo "=== apply-update-from-remote $(date -Is) ==="
} >>"$LOG_FILE"

if [[ "${EUID}" -ne 0 ]]; then
  echo "[apply-update-from-remote] ERROR: must run as root" >>"$LOG_FILE"
  exit 1
fi

if [[ ! -d "$ROOT/.git" ]]; then
  echo "--- no .git; running update.sh only ---" | tee -a "$LOG_FILE"
  exec bash "$ROOT/scripts/update.sh"
fi

if ! [[ "$REMOTE" =~ ^[a-zA-Z0-9_.-]+$ ]] || ! [[ "$BRANCH" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
  echo "[apply-update-from-remote] ERROR: invalid UPDATE_GIT_REMOTE or UPDATE_GIT_BRANCH" >>"$LOG_FILE"
  exit 1
fi

git fetch "$REMOTE" >>"$LOG_FILE" 2>&1

STASHED=0
if [[ "${UPDATE_GIT_NO_STASH:-0}" != "1" && "${UPDATE_GIT_NO_STASH:-}" != "true" ]]; then
  STASH_MSG=$(git stash push -u -m "nginx-warden-pre-update" 2>&1 || true)
  echo "$STASH_MSG" >>"$LOG_FILE"
  if ! echo "$STASH_MSG" | grep -qi "No local changes to save"; then
    STASHED=1
  fi
else
  echo "--- skip stash (UPDATE_GIT_NO_STASH) ---" >>"$LOG_FILE"
fi

if ! git checkout "$BRANCH" >>"$LOG_FILE" 2>&1; then
  echo "--- git checkout $BRANCH (warning, continuing) ---" >>"$LOG_FILE"
fi

if ! git pull --ff-only "$REMOTE" "$BRANCH" >>"$LOG_FILE" 2>&1; then
  echo "--- git pull failed ---" >>"$LOG_FILE"
  if [[ "$STASHED" -eq 1 ]]; then
    if ! git stash pop >>"$LOG_FILE" 2>&1; then
      echo "[apply-update-from-remote] stash pop failed; try: cd $ROOT && git stash pop" >>"$LOG_FILE"
    fi
  fi
  exit 1
fi

if [[ "$STASHED" -eq 1 ]]; then
  {
    echo ""
    echo "--- note ---"
    echo "Previous local changes are in git stash (nginx-warden-pre-update). Run \`git stash list\` and \`git stash show -p\` or \`git stash drop\` as needed."
  } >>"$LOG_FILE"
fi

exec bash "$ROOT/scripts/update.sh"
