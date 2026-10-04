# Nginx Warden Monitoring Baseline

This directory contains starter observability artifacts that can be imported into
an existing Prometheus/Grafana stack.

## Files

- `prometheus-alert-rules.yml`: baseline alerts for API health and auth/security pressure.
- `grafana-dashboard-nginx-warden.json`: simple dashboard template for request/error trends.

## Notes

- These assets are templates and should be tuned for your deployment volume.
- Expressions assume metrics are exported into Prometheus with labels that include
  `job="nginx-warden-api"`.
