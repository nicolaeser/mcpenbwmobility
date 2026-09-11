# Production

Load this document for Docker, compose, bind addresses, or production env.

`src/auth/production.ts` fail-closes HTTP when the process is exposed or `NODE_ENV=production`.

## Required on a non-loopback bind

- Stable `MCP_OAUTH_SECRET` of at least 32 characters. An ephemeral secret invalidates sessions
  across restarts and is refused in production.
- `MCPENBWMOBILITY_PUBLIC_URL` or `MCP_PUBLIC_URL` set to the public origin without `/mcp`. Host
  checks and token audience use it. Error text names `MCP_PUBLIC_URL`. `X-Forwarded-Host` is not
  trusted when this is unset.
- `MCP_AUTH_PASSWORD` unless `MCP_ALLOW_OPEN_CONSENT=1` on a trusted isolated network.

Bind host is `MCPENBWMOBILITY_HOST` or `MCP_HOST`. `docker-compose.yml` requires
`MCP_OAUTH_SECRET`, `MCP_AUTH_PASSWORD`, and `MCPENBWMOBILITY_PUBLIC_URL`, and drops
capabilities. `docker-compose.dev.yml` sets a labeled local secret, public URL
`http://127.0.0.1:8080`, and `MCP_ALLOW_OPEN_CONSENT=1` so a laptop tunnel can start.

The image runs as `node`, binds `0.0.0.0:8080`, and serves `/health`. Do not pass secrets on
argv. Do not commit `.env` or `tokens.json`.

Pushes to `main`/`master` publish `ghcr.io/<owner>/<repo>:latest`. Pushes to `development`
publish `:dev`. Semver tags `v*` also publish. Production `docker-compose.yml` pulls that
image (`:latest` by default; set `*_IMAGE_TAG=dev` for the development channel).
