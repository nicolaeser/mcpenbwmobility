# Login fields

Load this document when adding or changing consent questions.

`src/auth/login-fields.ts` is the only customization point for extra OAuth questions. Do not
fork `src/auth/consent.ts` or `src/auth/service.ts` to add a field. Visual branding of the
`/authorize` form lives in `src/auth/consent.html` (open that file in a browser to preview). When `MCP_AUTH_PASSWORD` is set, the server password is a separate Continue → Authorize step. `<!--slot:clientName-->` is the OAuth client, not the upstream brand.

This package collects myEnergyKey **email** (`ENBW_EMAIL`) and **password** (`ENBW_PASSWORD`).
Both are `secret: true` and `prompt: "if-missing"`.

## Field contract

Owned by `src/auth/fields.ts`:

- `name` must match `^[A-Za-z][A-Za-z0-9_]{0,63}$`.
- `secret: true` values go into `bag.secrets` and are encrypted into the access token.
- Non-secret values go into `bag.claims`.
- `envFallback` hides the field when that env var is already set (`prompt: "if-missing"`).
- `prompt: "always" | "if-missing" | "never"` controls visibility.
- Select fields require `options`.

A later change that needs a tenant id, region, or second credential must append a `LoginField`
here. The consent page renders whatever `visibleLoginFields` returns. Secrets must never be
logged or returned in tool text; `src/lib/redact.ts` strips `ctx.secrets`.
