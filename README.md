# Nginx Warden

Control plane for **nginx**, **ModSecurity (OWASP CRS)**, **SSL**, **domains / upstreams**, **alerts**, and **operations**—delivered as a **web UI** and **REST API** (Node + PostgreSQL).

**Repository:** [github.com/boxorandyos/nginx-warden](https://github.com/boxorandyos/nginx-warden)

---

## What it does

- Manage virtual hosts, upstreams, load balancing, and reload nginx safely.
- ModSecurity WAF: CRS toggles, custom rules, per-domain options.
- SSL: Let’s Encrypt and manual certificates.
- Monitoring: logs, performance, alerts (e.g. email / Telegram).
- Multi-user RBAC (admin / moderator / viewer), audit trail, optional 2FA.

The **supported production target** is **Linux** (Ubuntu/Debian-style) with **root** for install scripts, systemd, and nginx. The admin UI is a **browser app** (React); there is no requirement to run the control plane from Windows or macOS on the server.

---

## Quick reference

| Action | Command / location |
|--------|-------------------|
| **First-time production install** | `sudo bash scripts/deploy.sh` (from repo root; **CrowdSec** packages + LAPI keys in `apps/api/.env` + firewall template unless `WARDEN_SKIP_CROWDSEC=1`) |
| **Upgrade (CLI)** | `git pull` then `sudo bash scripts/update.sh` |
| **Upgrade (UI)** | Fleet → **Configuration** → *Download & update* (admin, API as root) |
| **Backend env** | `apps/api/.env` |
| **Frontend build env** | `apps/web/.env` (e.g. `VITE_API_URL=auto`) |
| **Saved deploy secrets** | `/root/.nginx-warden-credentials` (after `deploy.sh`) |

Install path = **wherever you clone the repo** (e.g. `/var/www/html/nginx-warden`). There is no fixed `/opt/...` path unless you put it there yourself.

---

## Ports

Defaults come from `scripts/deploy.sh` (override with env vars such as `WARDEN_UI_PORT`, `WARDEN_API_PORT`, `WARDEN_DB_HOST_PORT`, `CROWDSEC_LAPI_PORT`).

| Port | Service |
|------|---------|
| **8088** | Admin UI (Vite `pnpm preview` in production systemd unit; default avoids clashing with other services) |
| **3001** | REST API |
| **9091** | CrowdSec Local API (loopback; `scripts/install-crowdsec.sh`) |
| **80 / 443** | Sites you front with nginx (managed via the product) |
| **15432** | PostgreSQL on the **host** (Docker maps container `5432` → host `15432`; see `deploy.sh`) |

Health check: `GET http://<host>:3001/api/health` (or your `WARDEN_API_PORT`)

---

## Production install

**Requirements (typical):** Ubuntu/Debian, root, 2 GB+ RAM, Docker for PostgreSQL as used by `deploy.sh`, outbound internet for packages and (optional) ACME.

```bash
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden
sudo bash scripts/deploy.sh
```

The script installs dependencies, builds API + UI, configures **systemd** units (`nginx-warden-backend`, `nginx-warden-frontend`), nginx/ModSecurity where applicable, runs **`scripts/install-crowdsec.sh`** then **`scripts/crowdsec-autoconfigure.sh`** (CrowdSec engine + nftables firewall bouncer + LAPI bouncer keys written to **`apps/api/.env`**, firewall template applied, backend restarted; skip all CrowdSec with `WARDEN_SKIP_CROWDSEC=1`), and writes **`apps/api/.env`** and **`apps/web/.env`**. Review generated secrets under **`/root/.nginx-warden-credentials`** (includes CrowdSec keys after autoconfigure).

### Configuration highlights

- **API / DB / JWT:** `apps/api/.env` — see `apps/api/.env.example`.
- **CORS + portal access:** set allowed UI origins in **Fleet → Configuration**; merge with `CORS_ORIGIN` in `apps/api/.env`.
- **API bind:** `HOST=0.0.0.0` (default) so the API listens on all interfaces; see `apps/api/.env.example`.
- **SPA → API URL:** `VITE_API_URL=auto` (default) uses the **same browser hostname** and port **3001** for API calls; use `VITE_API_USE_FIXED` + explicit `VITE_API_URL` only if the API is on a different host.
- **Monorepo path for jobs:** `NGINX_WARDEN_ROOT` if the API cannot infer the repo root.
- **Web-triggered update:** `ENABLE_WEB_SYSTEM_UPDATE`, `UPDATE_GIT_BRANCH`, `UPDATE_GIT_REMOTE` — see Fleet → Configuration.

---

## Upgrading

**CLI (recommended for long runs):**

```bash
cd /path/to/nginx-warden
git pull
sudo bash scripts/update.sh
```

`update.sh` stops services, installs deps, runs migrations, rebuilds, restarts systemd units, and updates nginx config from `config/nginx.conf` when present.

**UI:** Admins can run **Download & update** (git pull + `update.sh`) from Configuration; requires API as root and may take many minutes—avoid short proxy timeouts.

---

## Docker

Compose files live in the repo root (`docker-compose.yml`, `docker-compose.build.yml`, `docker-compose.db.yml`). Docker-based production is **advanced**; expect to adapt networking, volumes, and env yourself. There is **no** one-click in-place upgrade story for Compose comparable to `update.sh` on bare metal—plan maintenance windows and backups.

Helper script (if present): `docker/scripts/docker.sh` — read it before use.

---

## Development

**Quick local stack (see `scripts/quickstart.sh`):** installs deps, may start Postgres in Docker, migrates/seeds, runs API and Vite dev server—**no** full nginx/ModSecurity install, **no** root required for the basic path.

Manual two-terminal flow:

```bash
pnpm install
cd apps/api && cp .env.example .env   # set DATABASE_URL, secrets
pnpm prisma migrate deploy   # or dev migrate per your workflow
cd ../web && cp .env.example .env      # VITE_API_URL=auto or http://localhost:3001/api

# Terminal 1 — API
cd apps/api && pnpm dev

# Terminal 2 — UI
cd apps/web && pnpm dev    # http://localhost:8080
```

Monorepo scripts: `pnpm build`, `pnpm lint`, `pnpm test` (per package).

---

## Operations

### systemd (production)

```bash
sudo systemctl {start|stop|restart|status} nginx-warden-backend
sudo systemctl {start|stop|restart|status} nginx-warden-frontend
sudo systemctl {reload|restart} nginx
docker start|stop|restart nginx-warden-postgres   # if using deploy.sh DB container
```

### Logs

```bash
sudo journalctl -u nginx-warden-backend -f
sudo journalctl -u nginx-warden-frontend -f
tail -f /var/log/nginx-warden-backend.log
tail -f /var/log/nginx-warden-frontend.log
docker logs -f nginx-warden-postgres
sudo tail -f /var/log/nginx/error.log
```

---

## Troubleshooting (short)

| Issue | What to check |
|-------|----------------|
| **Port in use** | `sudo ss -tlnp` — look for listeners on 3001 (API) and 8080 (UI); stop conflicting services. |
| **DB connection** | `apps/api/.env` `DATABASE_URL`; container `docker ps`; `pnpm prisma migrate deploy` in `apps/api`. |
| **CORS / API from browser** | Allowed origins in Configuration + `CORS_ORIGIN`; SPA using same host:3001 with `VITE_API_URL=auto`. |
| **git pull blocked (dirty tree)** | The UI update runs `git stash push -u` before `git pull` so local edits and untracked files do not block merges. If pull still fails (diverged branches), on the server run `git fetch` / `git status` and resolve (merge, rebase, or `git reset --hard origin/main` if you accept losing local commits). |
| **nginx / ModSecurity** | `sudo nginx -t`; error log; ModSecurity audit paths on your install. |
| **SSL** | Certificate paths in UI; ACME challenge reachability. |

---

## Documentation in this repo

| Resource | Path |
|----------|------|
| API overview | [docs/API.md](docs/API.md) |
| OpenAPI | [apps/api/openapi.yaml](apps/api/openapi.yaml) |
| Prisma schema | [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) |
| Install guide (docs site) | [apps/docs/guide/installation.md](apps/docs/guide/installation.md) |
| Scripts | [scripts/](scripts/) |

---

## Tech stack (summary)

| Layer | Stack |
|-------|--------|
| **UI** | React, TypeScript, Vite, TanStack Router & Query, Tailwind, Radix / shadcn-style components, i18next |
| **API** | Node.js, Express, Prisma, PostgreSQL, JWT + refresh, optional 2FA |
| **Edge** | nginx, ModSecurity, OWASP CRS (as configured by your install) |

---

## Contributing

1. Fork and branch from `main` (or the default development branch).
2. Keep changes focused; match existing style and patterns.
3. Run lint/tests for packages you touch (`pnpm lint`, package-level tests).
4. Open a PR with a clear description; link issues when relevant.

Commit messages: conventional prefixes (`feat:`, `fix:`, `docs:`, …) are welcome.

---

## Security

Report vulnerabilities **privately** via [GitHub Security Advisories](https://github.com/boxorandyos/nginx-warden/security) for this repository (or maintainers’ published security policy). Do not open public issues for unfixed exploits.

---

## License

[Apache License 2.0](LICENSE)

---

## Acknowledgments

- [OWASP ModSecurity Core Rule Set](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [Nginx](https://nginx.org/) · [ModSecurity](https://modsecurity.org/)
- [Prisma](https://www.prisma.io/) · [PostgreSQL](https://www.postgresql.org/)
