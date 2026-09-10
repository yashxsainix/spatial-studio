# Security posture

This build is localhost-first and does not send API keys to the browser. `.env` is gitignored. Static responses add basic browser security headers.

Do not expose this server publicly yet. Public production deployment still needs identity/authentication, per-project authorization, CSRF protection where applicable, rate limiting, a managed database, encrypted blob storage, secret management, observability, backups, retention policies, and privacy/consent controls for real client media.
