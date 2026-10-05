#!/usr/bin/env bash
# Replace the system Node.js major on purpose. deploy.sh and update.sh do not call this.
# Usage: sudo UPGRADE_NODE_CONFIRM=1 bash scripts/upgrade-node.sh <22|24|26>
set -euo pipefail

MAJOR="${1:-}"
case "${MAJOR}" in
  22|24|26) ;;
  *)
    echo "Usage: sudo UPGRADE_NODE_CONFIRM=1 bash scripts/upgrade-node.sh <22|24|26>" >&2
    echo "24 is the current long-term support line. 26 is Current until it enters long-term support." >&2
    exit 2
    ;;
esac

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi
if [[ "${UPGRADE_NODE_CONFIRM:-}" != 1 ]]; then
  echo "This replaces the nodejs package on this machine. The API stays on the old process until you rebuild and restart." >&2
  echo "Re-run with UPGRADE_NODE_CONFIRM=1 after you have a maintenance window for the rebuild." >&2
  exit 2
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script installs Node from NodeSource with apt. It does not support this OS." >&2
  exit 1
fi

current=0
if command -v node >/dev/null 2>&1; then
  current="$(node -v | cut -d. -f1 | tr -d v)"
fi
if [[ "${current}" -eq "${MAJOR}" ]]; then
  echo "Node $(node -v) is already major ${MAJOR}."
  exit 0
fi
if [[ "${current}" -gt "${MAJOR}" ]]; then
  echo "Node $(node -v) is newer than ${MAJOR}. Refusing to downgrade." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
curl -fsSL "https://deb.nodesource.com/setup_${MAJOR}.x" | bash -
apt-get install -y nodejs
hash -r || true
echo "Node is now $(node -v)."
echo "Rebuild and restart before serving traffic: sudo bash scripts/update.sh"
echo "update.sh fast-forwards git, reinstalls dependencies, and restarts the systemd units."
echo "To return to the previous major, install it from NodeSource again. This script will not downgrade."
