#!/usr/bin/env bash
# Copy Nginx Warden's Postgres into a new major. The running container and its volume stay as they are.
# Usage: sudo UPGRADE_POSTGRES_CONFIRM=1 bash scripts/upgrade-postgres.sh <16|17|18>
set -euo pipefail

TARGET="${1:-}"
case "${TARGET}" in
  16|17|18) ;;
  *)
    echo "Usage: sudo UPGRADE_POSTGRES_CONFIRM=1 bash scripts/upgrade-postgres.sh <16|17|18>" >&2
    echo "The new database listens on 127.0.0.1:15440 unless --port is set. The live database is not stopped." >&2
    exit 2
    ;;
esac

PORT=15440
if [[ "${2:-}" == "--port" ]]; then
  PORT="${3:-}"
fi
if [[ ! "${PORT}" =~ ^[0-9]+$ ]]; then
  echo "Port must be a number." >&2
  exit 2
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi
if [[ "${UPGRADE_POSTGRES_CONFIRM:-}" != 1 ]]; then
  echo "This starts a second Postgres and leaves nginx-warden-postgres running." >&2
  echo "Re-run with UPGRADE_POSTGRES_CONFIRM=1" >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

OLD="${NGINX_POSTGRES_CONTAINER:-nginx-warden-postgres}"
if ! docker inspect "${OLD}" >/dev/null 2>&1; then
  echo "Container ${OLD} was not found. Set NGINX_POSTGRES_CONTAINER if the name differs." >&2
  exit 1
fi

image="$(docker inspect -f '{{.Config.Image}}' "${OLD}")"
current="$(printf '%s' "${image}" | sed -n 's/.*postgres:\([0-9][0-9]*\).*/\1/p')"
if [[ -z "${current}" ]]; then
  echo "Could not read a Postgres major from image ${image}." >&2
  exit 1
fi
if [[ "${TARGET}" -le "${current}" ]]; then
  echo "Container ${OLD} is already Postgres ${current}. Refusing to move to ${TARGET}." >&2
  exit 1
fi

NEW="nginx-warden-postgres-${TARGET}"
VOLUME="nginx-warden-postgres-${TARGET}-data"
if docker inspect "${NEW}" >/dev/null 2>&1; then
  echo "Container ${NEW} already exists. It was left in place. Remove that container yourself if you want to retry. The live container was not touched." >&2
  exit 1
fi
if command -v ss >/dev/null 2>&1 && ss -tln | grep -E ":${PORT}([^0-9]|$)" >/dev/null; then
  echo "127.0.0.1:${PORT} is already in use. Re-run with --port <free-port>." >&2
  exit 1
fi

env_of() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${OLD}" | sed -n "s/^${1}=//p" | head -1
}
db_user="$(env_of POSTGRES_USER)"
db_name="$(env_of POSTGRES_DB)"
db_password="$(env_of POSTGRES_PASSWORD)"
if [[ -z "${db_user}" || -z "${db_name}" || -z "${db_password}" ]]; then
  echo "Container ${OLD} is missing POSTGRES_USER, POSTGRES_DB, or POSTGRES_PASSWORD." >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/var/backups/nginx-warden"
mkdir -p "${backup_dir}"
chmod 700 "${backup_dir}"
dump="${backup_dir}/postgres-${current}-to-${TARGET}-${stamp}.dump"

echo "Dumping ${OLD} (${image}) to ${dump}"
docker exec -u postgres "${OLD}" pg_dump -U "${db_user}" -d "${db_name}" --format=custom --file=/tmp/nginx-warden-upgrade.dump
docker cp "${OLD}:/tmp/nginx-warden-upgrade.dump" "${dump}"
docker exec -u postgres "${OLD}" rm -f /tmp/nginx-warden-upgrade.dump
chmod 600 "${dump}"

echo "Starting ${NEW} from postgres:${TARGET}-alpine on 127.0.0.1:${PORT}"
docker run -d \
  --name "${NEW}" \
  -e POSTGRES_DB="${db_name}" \
  -e POSTGRES_USER="${db_user}" \
  -e POSTGRES_PASSWORD="${db_password}" \
  -p "127.0.0.1:${PORT}:5432" \
  -v "${VOLUME}:/var/lib/postgresql/data" \
  --restart unless-stopped \
  "postgres:${TARGET}-alpine" >/dev/null

fail_new() {
  echo "$1" >&2
  echo "Stopping ${NEW}. Volume ${VOLUME} was kept. ${OLD} was not stopped." >&2
  docker stop "${NEW}" >/dev/null 2>&1 || true
  exit 1
}

ready=0
for _ in $(seq 1 60); do
  if docker exec -u postgres "${NEW}" pg_isready -U "${db_user}" -d "${db_name}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "${ready}" -ne 1 ]]; then
  fail_new "Postgres ${TARGET} did not become ready."
fi

docker cp "${dump}" "${NEW}:/tmp/nginx-warden-upgrade.dump"
if ! docker exec -u postgres "${NEW}" pg_restore --no-owner --exit-on-error -U "${db_user}" -d "${db_name}" /tmp/nginx-warden-upgrade.dump; then
  fail_new "pg_restore failed."
fi
docker exec -u postgres "${NEW}" rm -f /tmp/nginx-warden-upgrade.dump

echo "Restored into ${NEW}. ${OLD} is still the database the API uses."
echo "Check the copy: docker exec -u postgres ${NEW} psql -U ${db_user} -d ${db_name} -c '\\dt'"
echo "When you are ready to switch, stop the API and point apps/api/.env DATABASE_URL at port ${PORT}."
echo "The user, password, and database name match ${OLD}. The password is the one from the first deploy (/root/.nginx-warden-credentials) or POSTGRES_PASSWORD on that container."
echo "  postgresql://${db_user}:<password>@localhost:${PORT}/${db_name}?schema=public"
echo "Then restart the API. Roll back by pointing DATABASE_URL at the original port again."
echo "Do not re-run scripts/deploy.sh after this. That script deletes the volume nginx-warden-postgres-data."
echo "Dump kept at ${dump}"
