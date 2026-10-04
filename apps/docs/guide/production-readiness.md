# Production Readiness

This guide tracks operational requirements before promoting Nginx Warden to production.

## Implemented hardening

- Startup runtime secret checks for production mode:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `SESSION_SECRET`
- API hardening defaults:
  - Helmet security headers
  - explicit body-size limits
  - HTTP request/header/keepalive timeouts
  - unknown request-field rejection on sensitive payloads
- Auth endpoint throttling for login, refresh, 2FA verification, and first-login password change.
- Slave node registration validation improvements.
- Identity provider admin-update validation constraints.
- Release gate script: `scripts/release/go-no-go.sh`.
- Monitoring templates: `deployments/monitoring/*`.

## Remaining production gates

1. Run end-to-end staging verification with production-like traffic and data.
2. Wire/export metrics for your monitoring backend and tune alert thresholds.
3. Complete external security review and operational sign-off.
4. Confirm secret management integration policy in deployment automation.
