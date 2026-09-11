# Architecture

Load this document when choosing which layer a change belongs in.

This package is a hostable MCP server for EnBW mobility+. Stdio is the local process transport.
HTTP is Streamable HTTP at `/mcp` plus OAuth at `/authorize`, `/token`, `/register`, and RFC 9728
metadata.

Upstream is the unofficial consumer EMP API used by the Android app: myEnergyKey (Auth0 PKCE)
then `https://api.emp.emob-enbw.com/emobility-complete/api/`. EnBW collect (loyalty points and
5 € vouchers) uses the same myEnergyKey login, then the Salesforce Experience Cloud site at
`collect.enbw.com` (`EnBWCollectController` Apex). Wallet redeem is EMP `v1/voucher/redeem`.

## Entry points

- `src/index.ts` — CLI: stdio by default, `http` for the listener.
- `src/http-main.ts` — HTTP process. Refuses tokens on argv.
- `src/transport/stdio.ts` — stdio MCP. Uses `ENBW_EMAIL` / `ENBW_PASSWORD`. Must not speak OAuth.
- `src/transport/http.ts` — Express app, session map, Host allowlist, health.
- `src/auth/routes.ts` — OAuth HTTP surface and consent POST.
- `src/emp/client.ts` — EMP HTTP client. Login secrets stay in the bag; tools never return them.
- `src/collect/client.ts` — EnBW collect Salesforce client (points, issued vouchers, 5 € redeem).
- `src/mcp/server.ts` and `src/mcp/catalog.ts` — MCP server and tool catalog.
- `src/auth/login-fields.ts` — the only login-question customization point.

## Facts that are easy to get wrong

- HTTP Bearer must be an `mcp1.` session token from this host. A myEnergyKey password is not a
  connector credential.
- Tool handlers receive EMP credentials from the sealed login bag, never from the client.
- `enbw_start_charging` and `enbw_stop_charging` require `confirm: true`.
- Collect/wallet writes (`enbw_redeem_collect_points`, `enbw_redeem_voucher`,
  `enbw_apply_issued_collect_vouchers`) require `confirm: true`. Each Collect voucher is 500
  points / 5 €.
- `scripts/index-tools.mjs` regenerates the catalog index on `prebuild` / `pretest`.
