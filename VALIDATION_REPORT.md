# Spatial Studio V0.5 — Validation report

Validated September 10, 2026.

## Automated result

```bash
npm test
```

**29/29 tests passing.**

Coverage includes:

- KIRI documented `code: 0` and observed live `code: 200` success envelopes
- project → media → Direction → Capture Check → KIRI submission → polling → success
- mandatory real task ID and duplicate-submission protection
- ambiguous-submission recovery and zero-credit protection
- MOV normalization and media readiness checks
- finished model ZIP caching
- KIRI-style Gaussian Splat + `cameras.json` extraction
- Deflate and stored ZIP entries
- local scene-asset serving
- persistent saved start pose
- camera-height navigation state
- persistent spatial portal configuration
- safe portal URL / coordinate normalization
- customer Experience Preview availability
- exported v5 manifest including scene composition state

## Runtime smoke checks

- Server syntax and modules validate under Node.js.
- Local server starts as V0.5.0.
- `/api/health`, `/scene-lab.html`, and `/experience.html` return successfully.
- No additional npm install is required.

## Live boundary

Provider tests use a deterministic mock matching the KIRI gateway contract previously observed in the live account. Real KIRI and Astra calls still use the user's local `.env`. Browser rendering uses pinned PlayCanvas packages from jsDelivr and should be visually verified on the target Mac/browser before a client demonstration.
