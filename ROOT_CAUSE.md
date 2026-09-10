# Root-cause analysis — KIRI success-contract mismatch

## Confirmed root cause

The original V0.2/V0.3 KIRI adapter assumed that **every successful KIRI JSON response must contain `code: 0`** because that is what KIRI's public documentation currently shows.

On the user's live KIRI account, the authenticated `/balance` request returned an HTTP-success response whose JSON provider code was **`200`**. V0.3 treated any non-zero provider code as a business failure, so startup printed:

`KIRI not ready · KIRI rejected the request (provider code 200).`

This also explains the earlier V0.2 symptom where clicking reconstruction produced a toast containing only `success`: the old parser threw `data.msg` as the error text whenever `data.code !== 0`. A live response shaped like `{ code: 200, msg: "success", ... }` therefore became an exception literally named `success` before the app ever got a chance to persist the KIRI task ID.

The failure was therefore **not caused by the API key, Astra, the project, or the video at startup**. It was a provider-envelope compatibility bug in Spatial Studio.

## Why the previous fix did not solve it

V0.3 improved diagnostics and task-ID safety, but its generic KIRI envelope parser still contained this rule:

```js
const businessFailure = Number.isFinite(code) && code !== 0;
```

That rule is too rigid for a provider whose documented success envelope and live gateway envelope can differ.

## Correct provider contract

V0.3.2 separates transport truth, envelope truth, and endpoint truth:

1. **HTTP transport** — any HTTP 4xx/5xx is a failure regardless of body text.
2. **Explicit provider failure** — `ok: false` is a failure even if `code` is 0 or 200.
3. **Success code compatibility** — body `code: 0` (documented) and body `code: 200` (observed live gateway) are accepted as success-compatible values.
4. **Known provider errors** — KIRI codes such as 2009 and 2010 remain failures.
5. **Endpoint semantic validation** — a balance call must contain a real numeric balance; a reconstruction submission must contain `data.serialize`; a model-status call must contain a documented status; a model download must contain a URL. A vague `success` message is never enough.

This is a stronger architecture than simply adding `|| code === 200` to one screen because every KIRI endpoint now passes through the same compatibility layer and then through endpoint-specific validation.

## Additional reliability protections retained

- KIRI authentication and credit balance are checked before a paid scan.
- MOV/oversized capture can be normalized to H.264 MP4 before upload.
- Video is streamed from disk rather than buffered entirely in memory.
- A reconstruction is only recorded as submitted when a real `serialize` task ID exists.
- Duplicate active submissions are blocked.
- Uncertain network/protocol outcomes block blind retries.
- Existing KIRI task IDs can be attached and recovered.
- Completed model ZIPs are cached locally before temporary provider URLs expire.
- `npm run doctor:kiri` verifies the live KIRI connection without printing the API secret.

## Documentation discrepancy

KIRI's current public examples show successful JSON with `code: 0`, while KIRI's HTTP status documentation says HTTP 200 indicates success. The user's live response demonstrated an additional body-code-200 success variant. V0.3.2 deliberately supports both rather than hard-coding one representation.
