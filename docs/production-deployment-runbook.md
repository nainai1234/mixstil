# SNOOZE Production Deployment Runbook

Status: required before Voice-free Beta deployment

## Runtime Topology

- Deploy the API behind HTTPS and a trusted reverse proxy.
- Use managed PostgreSQL with encrypted backups and point-in-time recovery.
- Store rendered exports in S3 or an S3-compatible persistent object store.
- Deliver rendered exports through a controlled HTTPS CDN or object-storage public base URL.
- Keep approved source `/audio` assets in the immutable application image for the Voice-free Beta.

Local development continues to use `public/exports`; production rejects local export storage.

## Required Environment

```text
NODE_ENV=production
API_PORT=8788
DATABASE_URL=postgres://...
SHARE_CREATOR_PREVIEW_SECRET=<unique 32+ character secret>
CORS_ALLOWED_ORIGINS=https://app.example.com,capacitor://localhost
TRUST_PROXY=1
GUIDED_VOICE_ENABLED=false
METRICS_BEARER_TOKEN=<unique 32+ character secret>
STORAGE_DRIVER=s3
STORAGE_BUCKET=<private production bucket>
STORAGE_REGION=us-west-2
STORAGE_PUBLIC_BASE_URL=https://cdn.example.com/exports
EXPORT_MAX_OBJECT_BYTES=314572800
EXPORT_RETENTION_DAYS=30
MONITORING_LIVE_URL=https://api.example.com/api/health/live
MONITORING_READY_URL=https://api.example.com/api/health/ready
MONITORING_METRICS_URL=https://api.example.com/internal/metrics
```

`DATABASE_URL` must not target localhost. `CORS_ALLOWED_ORIGINS` must contain only the deployed HTTPS web origin and the native Capacitor origin. Never commit runtime secrets.

For an S3-compatible provider, set `STORAGE_ENDPOINT` and, only when required,
`STORAGE_FORCE_PATH_STYLE=true`. Runtime credentials use the provider's standard
credential chain. The bucket must deny listing and writes to anonymous callers;
the CDN/public origin needs read access only to generated exports.

## First Deployment

1. Provision an empty managed PostgreSQL database.
2. Run `pnpm db:bootstrap` once from a controlled release job.
3. Run `pnpm validate:production-security` and `pnpm validate:production-operations`.
4. Build with `pnpm build` and `pnpm mobile:build`.
5. Start the API with `NODE_ENV=production pnpm dev:api`.
6. Require `/api/health/live` and `/api/health/ready` to pass before routing traffic.

Normal production API startup only checks database connectivity. It does not create tables or seed content.

`pnpm mobile:build` is a code/bundle check and can run without deployment
credentials. Store-candidate preparation must use `pnpm mobile:sync`, followed
by `pnpm mobile:release:ios` or `pnpm mobile:release:android`; these commands
reject local/example API origins, missing versions, and missing signing inputs.

## Monitoring And Alerts

The API emits one JSON object per log line. Request logs contain request ID,
method, normalized route, status, and latency. Error logs contain a safe error
class and error name; bearer tokens, request bodies, prompts, passwords, and
health information are never logged.

Configure the deployment platform or monitoring agent to:

- Probe `/api/health/live` and `/api/health/ready` without authentication.
- Scrape `/internal/metrics` with `Authorization: Bearer <METRICS_BEARER_TOKEN>`.
- Ingest stdout/stderr JSON logs and preserve `request_id` for correlation.
- Alert on 5xx rate, P95 latency, readiness failure, generation/render/storage
  failure, and missing metrics or logs.

The metrics endpoint uses Prometheus text exposition but is vendor-neutral. A
managed Prometheus service, OpenTelemetry collector, or platform monitoring
agent can perform the scrape. Process-local counters reset on restart; the
external system owns durable history and alert evaluation.

Initial Beta alert thresholds:

- Readiness failure for 2 consecutive minutes: page.
- 5xx above 2 percent for 5 minutes: page.
- HTTP P95 above 2 seconds for 10 minutes: warn; generation P95 is evaluated
  separately against the 12-second product gate.
- Any sustained storage failure or render failure above 5 percent for 10
  minutes: page.
- No metrics or logs from an expected healthy instance for 5 minutes: page.

The in-memory rate limiter and process-local metrics are appropriate only for
the initial single-instance Beta. Horizontally scaled enforcement requires a
shared rate-limit store; durable metrics must always live in the external
monitoring system.

## Export Retention And Capacity

Each export is limited by `EXPORT_MAX_OBJECT_BYTES`. Local development also
has `EXPORT_MAX_LOCAL_BYTES`. Run the cleanup job daily from a controlled
scheduler:

```bash
EXPORT_RETENTION_DAYS=30 pnpm storage:prune
```

The job deletes only objects older than the retention window that are not
referenced by a ready mix. Use object-store lifecycle rules as a second safety
net for abandoned multipart uploads, but do not expire referenced exports.
Alert on bucket growth, object count, failed uploads/deletes, and projected
capacity or spend.

## Backup And Restore

Create and verify a PostgreSQL custom-format backup:

```bash
BACKUP_DIR=/secure/backups pnpm db:backup
```

Restore only into a disposable recovery database first:

```bash
RESTORE_FILE=/secure/backups/snooze-YYYYMMDDTHHMMSSZ.dump \
CONFIRM_DATABASE_RESTORE=RESTORE \
DATABASE_URL=postgres://recovery... \
pnpm db:restore
```

Run a recovery drill before launch and at least monthly during Beta. Confirm users, preferences, mixes, frozen versions, playback states, and share links are present after restore.

## Release Gate

Run the repository gate first:

```bash
pnpm release:check:code
```

This starts an isolated API and validates the production configuration
contracts, the frozen 111-Stem content release baseline, builds, core ToC
journey, user isolation, playback telemetry, Explore, My Sounds, Voice-free
Beta, native privacy, and Sprint 1-4 code contracts. When physical phone tests
are explicitly deferred, the Sprint 1 mobile playback portion runs in
code-only mode: code can be GO while `releaseApproved` stays false until the
Android physical-device rows and audible-continuity evidence are complete. It produces
timestamped JSON and Markdown reports under `reports/release-candidate/`.

For an actual release, create the ignored `release-evidence.local.json` from
`docs/release-evidence.example.json`, attach concrete evidence to every row,
then run:

```bash
pnpm release:check
```

The full command returns NO-GO until both code checks and every external
infrastructure, store, privacy, account-deletion, and physical-device gate are
passed. A code-only GO is never store approval.

- Production configuration validation passes.
- Database backup exists and a restore drill has passed.
- Health endpoints are monitored externally.
- 5xx rate, latency, database saturation, and disk usage have alerts.
- Object storage and CDN delivery have been verified with a real production object.
- Metrics scraping, JSON log ingestion, and alert delivery have been exercised.
- Export retention cleanup and capacity alerts are active.
- The production mobile bundle contains the real HTTPS API origin.
- Internal QA routes are not linked from production navigation.
- Sprint 1 physical-device release matrix is complete.

If phone testing is intentionally skipped for an implementation pass, run:

```bash
pnpm validate:sprint1-mobile-playback-code-only
```

This keeps development moving but records the remaining device blockers in a
timestamped report. It must not be used as store-release approval.
