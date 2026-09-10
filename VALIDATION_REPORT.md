# Spatial Studio V0.3.2 — Validation report

Validated September 10, 2026.

## Automated result

Run:

```bash
npm test
```

Current result: **21/21 passing**.

The suite now reproduces the exact live-provider compatibility issue that broke V0.3: successful KIRI responses with provider body `code: 200` are used throughout the mock end-to-end flow.

Covered scenarios include:

- KIRI documented success envelope (`code: 0`).
- KIRI observed live-gateway success envelope (`code: 200`).
- String form `code: "200"`.
- Explicit `ok: false` overriding a success-compatible code.
- HTTP 4xx overriding a misleading success-looking JSON body.
- Live balance verification using body code 200.
- Full project → media → Direction → Capture Check → KIRI submission → real task-ID persistence → queue/status polling → success → model ZIP retrieval → local artifact serving, using the body-code-200 contract.
- Duplicate active-job prevention.
- Missing `serialize` / protocol anomaly protection.
- Ambiguous submission handling and deliberate reset workflow.
- Zero KIRI credit blocking before upload.
- Existing KIRI task recovery/attachment.
- Documented KIRI status mapping (-1, 0, 1, 2, 3, 4).
- KIRI error 2009 (video requirements).
- KIRI error 2010 (file format).
- KIRI HTTP 403 / insufficient credits.
- MP4 provider-safe passthrough.
- MOV normalization requirement.
- Actual MOV → H.264 MP4 normalization in the test environment.
- Unknown video duration/dimensions rejected by capture readiness.
- Valid 1920×1080 / 30-second capture accepted.

## Additional checks

- All server/browser JavaScript passes `node --check` syntax validation.
- `.env` is ignored and is not included in the distributable.
- The server binds to `127.0.0.1` by default.
- Provider diagnostics never print the API key.
- A dedicated `npm run doctor:kiri` command reports connection, balance, provider body code, and detected success-contract variant without exposing the secret.
- Fresh-install package smoke test completed after packaging.

## What this validation can and cannot prove

The automated KIRI end-to-end tests use a deterministic local provider that now implements the **live body-code-200 response shape observed on the user's account**, as well as separate tests for KIRI's documented body-code-0 shape. The build environment does not possess the user's KIRI secret, so the final real-network verification must happen on the user's Mac by running `npm run doctor:kiri` after moving `.env` into the new folder.

## Production scope

V0.3.2 is hardened for the **local/internal pilot workflow**. It is not yet a public multi-user SaaS. Public deployment still requires authentication/authorization, managed database/object storage, encryption/key management, rate limiting, audit logs, backups, consent/retention/deletion controls, observability, and managed deployment secrets.
