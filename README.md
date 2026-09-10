# Spatial Studio V0.5 — Experience Builder

Spatial Studio is a local-first production workspace for turning real-world capture into an interactive spatial experience.

**Capture → Direct → Validate → Reconstruct → Compose → Preview**

It currently uses:

- Astra for production direction from project/media metadata
- KIRI Engine for 3D Gaussian Splat reconstruction
- PlayCanvas for the integrated Gaussian Splat viewer
- Local project storage for scene state, portals and preview configuration

## What V0.5 adds

V0.5 moves Spatial Studio beyond "reconstruction viewer" into a real experience-building workflow.

- Finished KIRI jobs are cached and automatically prepared for Scene Lab.
- `3DGS.ply` / supported splat formats render inside Spatial Studio.
- `cameras.json` is used to start from real capture poses instead of raw scene bounds.
- The producer can save a customer start view.
- An optional camera-height lock provides a human-scale navigation baseline.
- Memory / information / link portals can be placed in 3D space and saved with the project.
- A separate customer-facing Experience Preview opens the composed world.
- Scene composition is stored independently from KIRI so reconstruction providers remain replaceable.
- Astra instructions now treat assigned media roles as authoritative and no longer contradict a selected reconstruction source.

## Upgrade from V0.4.1 / V0.3.2

Keep the new application files and copy only these local runtime files from your working version:

- `.env`
- `data/` if you want to preserve existing projects, uploads, cached reconstructions and scene state

Never commit `.env` or `data/` to GitHub.

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

No `npm install` is required.

## Recommended first-project workflow

1. Create a project.
2. Upload a controlled walkthrough and mark it **Reconstruction source**.
3. Run **Direction**.
4. Pass **Capture Check**.
5. Start one KIRI reconstruction and wait for the real task to succeed.
6. Open **Scene Lab**.
7. Use a capture pose, adjust the view, then **Save start view**.
8. Place memory / information portals where they belong in the reconstructed world.
9. Turn on camera-height lock if useful for the experience.
10. Open **Experience Preview** and review the customer-facing result.

## Scene Lab

A prepared project opens at:

```text
http://127.0.0.1:4173/scene-lab.html?project=PROJECT_ID
```

The Gaussian Splat is served locally. Pinned PlayCanvas modules are currently loaded from jsDelivr, so the renderer needs an internet connection.

Scene Lab supports:

- Gaussian Splat rendering
- capture-pose framing
- saved start camera
- camera-height lock
- persistent 3D portal placement
- local customer preview
- manual splat / camera JSON loading as a fallback

Camera-height lock is not full collision physics. Proper floor/wall collision and WebXR locomotion are later product layers.

## Reliability and safety

- A real KIRI `serialize` task ID remains mandatory.
- Documented KIRI `code: 0` and observed live `code: 200` success contracts are supported.
- Duplicate paid submissions are blocked.
- Ambiguous submissions are quarantined rather than retried automatically.
- Zero-credit jobs are blocked before upload.
- MOV / oversized video normalization remains supported when a local converter is available.
- Finished KIRI ZIPs are cached locally because provider download links are temporary.
- ZIP extraction validates entries and never writes arbitrary nested paths.
- Scene state validates coordinates, limits portal count and only keeps local or HTTP(S) portal URLs.
- API keys remain server-side.

## Tests

```bash
npm test
```

Current automated validation: **29/29 passing**.

## Product boundary

V0.5 is ready for **local/internal pilots and demonstrations**. It is not yet a public multi-user SaaS. Before exposing it publicly, add user authentication, per-project authorization, managed storage/database, CSRF protections where relevant, rate limiting, monitoring, backups, retention/privacy controls, and a deployment-grade asset pipeline.
