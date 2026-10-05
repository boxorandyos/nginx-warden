# Runtime upgrades

`scripts/update.sh` updates the application. It does not move Node or PostgreSQL to a new major. Fresh installs still use Node 20 and `postgres:15-alpine`. Those stay until you run the steps below, so an ordinary deploy does not rewrite a working server.

Supported majors still receive fixes. Move a server before the major you are on stops receiving them. Node 20 is in maintenance until April 2027. PostgreSQL 15 is still a supported release line. PostgreSQL 19 is a beta and is not a target of these scripts.

## Node.js

The API and the admin UI are rebuilt against whatever `node` is on `PATH`.

```bash
sudo UPGRADE_NODE_CONFIRM=1 bash scripts/upgrade-node.sh 24
sudo bash scripts/update.sh
```

`24` is the long-term support line. `26` is Current and can be passed the same way once you accept that it is not long-term support yet. `22` is the previous long-term support line. The script refuses to install an older major than the one already on the machine.

`update.sh` reinstalls dependencies and restarts the systemd units. Until that rebuild finishes, leave the existing processes running. This script is not invoked by `deploy.sh` or `update.sh`.

pnpm stays on the `packageManager` field in `package.json` (`pnpm@8.15.0` today). `deploy.sh` installs that exact version when pnpm is missing or older. Installing a newer pnpm on the server by itself will not match the lockfile. A newer pnpm ships only in a release that updates `packageManager` and `pnpm-lock.yaml` together.

## PostgreSQL

The data directory inside `nginx-warden-postgres-data` cannot start on a newer major. `scripts/upgrade-postgres.sh` dumps the live database, starts `postgres:<major>-alpine` beside it, and restores into a new volume. The container `nginx-warden-postgres` keeps running, and `apps/api/.env` is not edited.

```bash
sudo UPGRADE_POSTGRES_CONFIRM=1 bash scripts/upgrade-postgres.sh 16
```

Allowed targets are 16, 17, and 18, and the target must be newer than the running image. The copy listens on `127.0.0.1:15440` (override with `--port`). Switch by pointing `DATABASE_URL` at that port after you have queried the copy. Point it back at the original port to roll back.

`scripts/deploy.sh` is a first-time install. It removes the volume `nginx-warden-postgres-data`. Do not run it as an upgrade, and do not run it to pick up a Postgres major. The new volume uses a different name, so that wipe does not delete the copy.

## What stays pinned

| Piece | Still installed as | How it moves |
|---|---|---|
| Node on a new server | 20.x | `scripts/upgrade-node.sh`, then `scripts/update.sh` |
| pnpm | `packageManager` in `package.json` | A release that updates the lockfile |
| PostgreSQL | `postgres:15-alpine` | `scripts/upgrade-postgres.sh` |
| Image builds | `node:20-alpine` | `docker build --build-arg NODE_IMAGE=node:24-alpine` |
