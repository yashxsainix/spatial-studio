# Security posture

Spatial Studio V0.5 is localhost-first.

Current protections:

- `.env` and `data/` are gitignored
- provider/API secrets stay server-side
- uploads and JSON bodies have size limits
- filenames are normalized before local storage
- reconstruction ZIP extraction validates offsets, sizes and supported formats
- spatial scene state validates numeric coordinates and limits portal count
- portal URLs are restricted to local paths or HTTP(S)
- static responses use basic security headers

Do **not** expose this localhost server directly to the public internet.

A public product still needs identity/authentication, per-project authorization, CSRF protections where applicable, rate limiting, managed database/blob storage, secret management, encryption strategy, observability, backups, retention/deletion controls, consent/privacy workflows for captured people, and deployment-specific content security policy.
