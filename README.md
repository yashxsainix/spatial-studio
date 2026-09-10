# Spatial Studio V0.3.2 — Provider Compatibility Build

A local-first production workspace for turning captured media into spatial experiences with Astra direction and KIRI Engine 3DGS reconstruction.

## Why V0.3.2 exists

KIRI's public API examples currently show successful JSON as `code: 0`, but the user's live KIRI gateway returned a successful authenticated response with provider body `code: 200`. Earlier Spatial Studio builds assumed every non-zero body code was an error. That assumption caused both the old misleading `success` toast and V0.3's startup message `KIRI rejected the request (provider code 200)`.

V0.3.2 replaces that assumption with a provider-contract adapter that supports both success forms while still requiring endpoint-specific proof of success.

## Setup

Move your existing `.env` into this folder next to `package.json`. Do not share the key values.

```text
KIRI_API_KEY=your_kiri_key
OPENAI_API_KEY=your_openai_key
```

Then run:

```bash
npm run doctor:kiri
```

A healthy live connection should print something like:

```text
Connection: OK
Credits: 8
Provider contract: live-code-200
Provider body code: 200
```

The exact credit number will be your account balance. The command never prints the API key.

Then start Spatial Studio:

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

No `npm install` is required.

## First reconstruction demo

1. Create a project.
2. Upload a short walkthrough video.
3. Assign **Reconstruction source**.
4. Create **Direction**.
5. Run **Capture Check**.
6. Open **Reconstruction**.
7. Click **Start real reconstruction** once.
8. Spatial Studio only treats the submission as real when KIRI returns a `serialize` task ID.
9. Active jobs are polled automatically.
10. When KIRI reports success, the model ZIP is retrieved and cached locally.

## Video requirements

KIRI documents a maximum of 1920×1080 and 3 minutes for 3DGS video. Spatial Studio can normalize MOV/oversized footage into a provider-safe H.264 MP4 copy when a local converter is available; the original upload is preserved.

## Reliability controls

- Supports KIRI success body `code: 0` and observed live body `code: 200`.
- HTTP errors and `ok: false` always override success-looking text/codes.
- KIRI errors 2009/2010 are mapped to useful diagnostics.
- A real task ID is mandatory before submission is considered successful.
- Paid scans are blocked if KIRI cannot be authenticated or has zero credits.
- Active duplicate submissions are blocked.
- Ambiguous network outcomes are marked uncertain instead of blindly retried.
- Existing provider task IDs can be recovered/attached.
- Large media is streamed from disk.
- Finished model ZIPs are cached locally.
- `.env` secrets remain server-side.

## Tests

```bash
npm test
```

Current validation: **21/21 passing**, including a complete mocked KIRI end-to-end flow using the same body-code-200 success contract observed on the live account. See `VALIDATION_REPORT.md` and `ROOT_CAUSE.md`.

## Scope

This build is production-hardened for an **internal/local pilot**. Do not expose it as a public SaaS with private customer media yet; authentication, managed storage/database, encryption, audit logs, privacy controls, backups, rate limits, and deployment observability still belong in the public-production phase.
