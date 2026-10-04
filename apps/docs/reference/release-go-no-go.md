# Release Go/No-Go Check

Use the release gate script to produce a simple deployment decision from local validation outputs.

## Run

```bash
./scripts/release/go-no-go.sh
```

Or write artifacts to a specific directory:

```bash
./scripts/release/go-no-go.sh ./artifacts/readiness-$(date -u +%Y%m%dT%H%M%SZ)
```

## Output

The script returns one of:

- `GO`
- `CONDITIONAL` (warnings only)
- `NO-GO` (at least one failed check)

It runs API tests/build, web build, and optional staging health probe if:

- `STAGING_API_BASE_URL`
- `STAGING_BEARER_TOKEN`

are provided.
