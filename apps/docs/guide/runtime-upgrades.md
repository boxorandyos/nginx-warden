# Runtime upgrades

`scripts/update.sh` updates the application. It does not move Node or PostgreSQL to a new major. A new install gets Node 22 and, when the data volume does not exist yet, Postgres 18. A server that already has Node, or already has `nginx-warden-postgres-data`, keeps that runtime until you start the move from Fleet → Configuration.

Node 24 is the current long-term support release. This API uses Prisma 5, which does not run on Node 24, so the console offers Node 22. Postgres 18 is the current stable major. Postgres 19 is a beta and is not a target.

## Node.js

The API and the admin UI are rebuilt against whatever `node` is on `PATH`.

From Fleet → Configuration, **Move Node to 22** runs:

```bash
sudo UPGRADE_NODE_CONFIRM=1 bash scripts/upgrade-node.sh 22
sudo bash scripts/update.sh
```

The same page's **Copy Postgres to 18** runs `scripts/upgrade-postgres.sh 18`. Web system update is enabled unless `ENABLE_WEB_SYSTEM_UPDATE` is `false` or `0`. `WARDEN_ALLOW_HOST_UPDATE=0` makes the API return the command instead of running it.

`22` is the newest long-term support line this API can run. The script refuses to install an older major than the one already on the machine.

`update.sh` reinstalls dependencies and restarts the systemd units. Until that rebuild finishes, leave the existing processes running. This script is not invoked by `deploy.sh` or `update.sh`.

pnpm stays on the `packageManager` field in `package.json` (`pnpm@8.15.0` today). `deploy.sh` installs that exact version when pnpm is missing or older. Installing a newer pnpm on the server by itself will not match the lockfile. A newer pnpm ships only in a release that updates `packageManager` and `pnpm-lock.yaml` together.

## PostgreSQL

The data directory inside `nginx-warden-postgres-data` cannot start on a newer major. `scripts/upgrade-postgres.sh` dumps the live database, starts `postgres:<major>-alpine` beside it, and restores into a new volume. The container `nginx-warden-postgres` keeps running, and `apps/api/.env` is not edited.

```bash
sudo UPGRADE_POSTGRES_CONFIRM=1 bash scripts/upgrade-postgres.sh 18
```

Allowed targets are 16, 17, and 18, and the target must be newer than the running image. The console uses 18. The copy listens on `127.0.0.1:15440` (override with `--port`). Switch by pointing `DATABASE_URL` at that port after you have queried the copy. Point it back at the original port to roll back.

`scripts/deploy.sh` keeps `nginx-warden-postgres-data` when it already exists and starts it with the image recorded in `/etc/nginx-warden/postgres.image`, or `postgres:15-alpine` when that file is missing. It creates `postgres:18-alpine` only when the volume is absent.

## What stays pinned

| Piece | Still installed as | How it moves |
|---|---|---|
| Node on a new server | 22.x | Fleet → Configuration, or `scripts/upgrade-node.sh` |
| pnpm | `packageManager` in `package.json` | A release that updates the lockfile |
| PostgreSQL on a new volume | `postgres:18-alpine` | Fleet → Configuration copies an older volume forward |
| Image builds | `node:22-alpine` | `docker build --build-arg NODE_IMAGE=node:24-alpine` once Prisma supports it |
