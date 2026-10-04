# Mail Warden

Open-source email security gateway for on-premises Exchange environments.

Mail Warden is designed to mirror the **operational philosophy** of Nginx Warden, but for SMTP:

- Nginx Warden protects web infrastructure by understanding HTTP behavior.
- Mail Warden protects mail infrastructure by understanding SMTP behavior, identity, reputation, and relationships.

## Project Status

- Phase: Concept / architecture baseline
- Primary target: On-premises Microsoft Exchange
- Deployment model: DMZ SMTP security gateway
- Traffic: Inbound and outbound
- Core content engine: Rspamd
- SMTP foundation: Postfix

## Core Design Principles

1. Evidence over assumptions
2. Bounded trust (no single positive signal can dominate)
3. Historical context matters
4. Current high-confidence risk can override trust
5. Explainable policy decisions

## MVP Scope (Bootstrap)

- SMTP ingress/egress architecture and policy contracts
- Normalized decision object
- Bounded-trust scoring engine with hard security gates
- Reputation and relationship model stubs
- Event model and telemetry contracts
- Exchange/AD/Entra integration design documents
- Deployment skeleton (Docker/systemd/VM docs)

## Repository Structure

```text
mail-warden/
├── cmd/
│   ├── mailwarden/
│   ├── policy-worker/
│   └── migrations/
├── internal/
│   ├── smtp/
│   ├── policy/
│   ├── reputation/
│   ├── identity/
│   ├── relationship/
│   ├── quarantine/
│   ├── rspamd/
│   ├── exchange/
│   ├── ldap/
│   ├── entra/
│   ├── database/
│   ├── events/
│   ├── scoring/
│   └── telemetry/
├── web/
│   ├── admin/
│   └── quarantine/
├── migrations/
├── configs/
├── deployments/
│   ├── docker/
│   ├── systemd/
│   └── vm/
├── docs/
└── tests/
```

## Build and Test

```bash
cd mail-warden
go test ./...
go run ./cmd/mailwarden -config ./configs/mailwarden.example.yaml
```

## Immediate Next Steps

1. Integrate Postfix policy delegation and Milter flow.
2. Implement Rspamd API adapter and result normalization.
3. Add PostgreSQL schema and Redis-backed counters.
4. Add quarantine persistence and release workflow.
5. Add LDAP auth for portal and admin API.
