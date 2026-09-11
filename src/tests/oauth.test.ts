import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createHttpApp, listenHttp } from "../transport/http.js";
import { MCP_PATH } from "../config.js";
import { signCsrf } from "../auth/crypto.js";
import {
  CONSENT_CSP,
  CONSENT_ERROR_GENERIC,
  CONSENT_ERROR_SESSION_EXPIRED
} from "../auth/consent.js";
import { PACKAGE_PRODUCT } from "../version.js";
import { INIT_PARAMS } from "./helpers.js";
import { EmpClient } from "../emp/client.js";
import { mockFetch } from "./helpers.js";

const OAUTH_SECRET = "test-oauth-secret-value-32chars-min";
const OPERATOR_PASSWORD = "operator-pass-12";
const EMAIL = "mobility-user@example.com";
const LOGIN_PASSWORD = "enbw-login-secret-pass!";
const REDIRECT = "https://client.example/oauth/callback";

describe("fail-closed HTTP credentials", () => {
  it("rejects a stolen myEnergyKey password as Bearer", async () => {
    const ctx = await startOauth();
    try {
      const health = await fetch(`${ctx.origin}/health`);
      expect(health.status).toBe(200);
      expect(((await health.json()) as { auth: string }).auth).toBe("oauth");

      const missing = await fetch(ctx.mcp, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT_PARAMS })
      });
      expect(missing.status).toBe(401);
      const www = missing.headers.get("www-authenticate") ?? "";
      expect(www).toMatch(/resource_metadata=/);
      expect(www).toMatch(/scope="mcp:tools"/);
      expect(www).toContain("mcpenbwmobility");

      const stolen = await fetch(ctx.mcp, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${LOGIN_PASSWORD}`
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
      });
      expect(stolen.status).toBe(401);
    } finally {
      await ctx.close();
    }
  });
});

describe("OAuth login fields", () => {
  it("collects myEnergyKey email and password on the consent page", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      expect(session.html).toContain("EnBW mobility+");
      expect(session.html).toContain("test-grok");
      expect(session.html).not.toContain("Cursor");
      expect(session.html).toContain("myEnergyKey email");
      expect(session.html).toContain("myEnergyKey password");
      expect(session.html).toContain('name="login_email"');
      expect(session.html).toContain('name="login_password"');
      expect(session.html).not.toContain("template_whoami");
      expect(session.html).not.toContain("API token");
      expect(session.csrf.startsWith("csrf1.")).toBe(true);

      const tokens = await loginForTokens(ctx, {
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        password: OPERATOR_PASSWORD
      });
      expect(tokens.access_token.startsWith("mcp1.")).toBe(true);
      expect(JSON.stringify(tokens)).not.toContain(LOGIN_PASSWORD);
      expect(JSON.stringify(tokens)).not.toContain(EMAIL);
    } finally {
      await ctx.close();
    }
  });

  it("hides login fields when ENBW_EMAIL and ENBW_PASSWORD are on the server", async () => {
    const ctx = await startOauth({
      env: {
        MCP_HOST: "127.0.0.1",
        MCP_OAUTH_SECRET: OAUTH_SECRET,
        MCP_AUTH_PASSWORD: OPERATOR_PASSWORD,
        ENBW_EMAIL: EMAIL,
        ENBW_PASSWORD: LOGIN_PASSWORD
      }
    });
    try {
      const session = await beginAuthorize(ctx);
      expect(session.html).toContain("Server password");
      expect(session.html).not.toContain('name="login_email"');
      expect(session.html).not.toContain('name="login_password"');
      const consented = await postConsent(ctx, session, { password: OPERATOR_PASSWORD, cookie: false });
      expect(consented.status).toBe(302);
    } finally {
      await ctx.close();
    }
  });
});

describe("consent CSRF", () => {
  it("authorizes without a cookie when the body CSRF is valid", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      const consented = await postConsent(ctx, session, {
        password: OPERATOR_PASSWORD,
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        cookie: false
      });
      expect(consented.status).toBe(302);
      expect(consented.headers.get("location") ?? "").toContain("code=");
    } finally {
      await ctx.close();
    }
  });

  it("rejects a broken HMAC body CSRF as session-expired", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      const consented = await postConsent(
        ctx,
        { ...session, csrf: "csrf1.not-a-valid-payload.not-a-valid-mac" },
        {
          password: OPERATOR_PASSWORD,
          email: EMAIL,
          loginPassword: LOGIN_PASSWORD,
          cookie: false
        }
      );
      expect(consented.status).toBe(401);
      expect(await consented.text()).toContain(CONSENT_ERROR_SESSION_EXPIRED);
    } finally {
      await ctx.close();
    }
  });

  it("reuses the same CSRF after a wrong operator password so retry succeeds", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      const denied = await postConsent(ctx, session, {
        password: "wrong-password-12",
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        cookie: false
      });
      expect(denied.status).toBe(401);
      expect(await denied.text()).toContain(CONSENT_ERROR_GENERIC);
      const retry = await postConsent(ctx, session, {
        password: OPERATOR_PASSWORD,
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        cookie: false
      });
      expect(retry.status).toBe(302);
    } finally {
      await ctx.close();
    }
  });

  it("rejects an expired CSRF body as session-expired", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      const expired = mintCsrf({
        n: "expired-nonce",
        exp: Date.now() - 1000,
        cid: session.hidden.client_id ?? "",
        ru: session.hidden.redirect_uri ?? REDIRECT,
        ch: session.hidden.code_challenge ?? ""
      });
      const consented = await postConsent(
        ctx,
        { ...session, csrf: expired },
        {
          password: OPERATOR_PASSWORD,
          email: EMAIL,
          loginPassword: LOGIN_PASSWORD,
          cookie: false
        }
      );
      expect(consented.status).toBe(401);
      expect(await consented.text()).toContain(CONSENT_ERROR_SESSION_EXPIRED);
    } finally {
      await ctx.close();
    }
  });
});

describe("login modes and session cap", () => {
  it("public mode: no operator password, myEnergyKey secrets are sealed", async () => {
    const ctx = await startOauth({ env: { MCP_AUTH_PASSWORD: "" } });
    try {
      const session = await beginAuthorize(ctx);
      expect(session.html).toContain("myEnergyKey email");
      expect(session.html).not.toMatch(/>Password</);
      expect(session.html).not.toContain('name="operator_password"');
      expect(session.html).toContain('name="login_password"');
      const denied = await postConsent(ctx, session, { password: "", cookie: false });
      expect(denied.status).toBe(401);
      const tokens = await loginForTokens(ctx, { email: EMAIL, loginPassword: LOGIN_PASSWORD, password: "" });
      expect(tokens.access_token.startsWith("mcp1.")).toBe(true);
      expect(JSON.stringify(tokens)).not.toContain(LOGIN_PASSWORD);
    } finally {
      await ctx.close();
    }
  });

  it("gated mode requires operator password plus myEnergyKey credentials", async () => {
    const ctx = await startOauth();
    try {
      const session = await beginAuthorize(ctx);
      expect(session.html).toContain("Authorize");
      expect(session.html).toContain('name="operator_password"');
      expect(session.html.indexOf("operator_password")).toBeGreaterThan(session.html.indexOf("login_email"));
      const denied = await postConsent(ctx, session, { password: OPERATOR_PASSWORD, cookie: false });
      expect(denied.status).toBe(401);
      const ok = await postConsent(ctx, session, {
        password: OPERATOR_PASSWORD,
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        cookie: false
      });
      expect(ok.status).toBe(302);
    } finally {
      await ctx.close();
    }
  });

  it("caps concurrent MCP sessions with MAX_SESSIONS", async () => {
    const ctx = await startOauth({ env: { MAX_SESSIONS: "1" } });
    try {
      const tokens = await loginForTokens(ctx, {
        email: EMAIL,
        loginPassword: LOGIN_PASSWORD,
        password: OPERATOR_PASSWORD
      });
      const init = { jsonrpc: "2.0", method: "initialize", params: INIT_PARAMS };
      const first = await fetch(ctx.mcp, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${tokens.access_token}`
        },
        body: JSON.stringify({ ...init, id: 1 })
      });
      expect(first.status).toBe(200);
      const second = await fetch(ctx.mcp, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${tokens.access_token}`
        },
        body: JSON.stringify({ ...init, id: 2 })
      });
      expect(second.status).toBe(429);
    } finally {
      await ctx.close();
    }
  });
});

interface OauthCtx {
  readonly origin: string;
  readonly mcp: string;
  close: () => Promise<void>;
}

interface AuthorizeSession {
  readonly html: string;
  readonly csrf: string;
  readonly cookie: string;
  readonly hidden: Record<string, string>;
}

async function startOauth(options: { env?: NodeJS.ProcessEnv } = {}): Promise<OauthCtx> {
  const env: NodeJS.ProcessEnv = {
    MCP_HOST: "127.0.0.1",
    MCP_OAUTH_SECRET: OAUTH_SECRET,
    MCP_AUTH_PASSWORD: OPERATOR_PASSWORD,
    ...options.env
  };
  const app = createHttpApp({
    env,
    createClient: (factory) =>
      new EmpClient({
        ...factory,
        accessToken: "emp-test-access-token",
        fetch: mockFetch(() => ({ json: {} }), [])
      })
  });
  const server = await listenHttp(app, { host: "127.0.0.1", port: 0 });
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    mcp: `${origin}${MCP_PATH}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}

async function loginForTokens(
  ctx: OauthCtx,
  input: { email: string; loginPassword: string; password: string }
): Promise<{ access_token: string }> {
  const session = await beginAuthorize(ctx);
  const consented = await postConsent(ctx, session, {
    password: input.password,
    email: input.email,
    loginPassword: input.loginPassword
  });
  const code = new URL(consented.headers.get("location") ?? "http://local").searchParams.get("code");
  const tokens = await fetch(`${ctx.origin}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code ?? "",
      code_verifier: session.hidden.challenge_verifier ?? "",
      client_id: session.hidden.client_id ?? "",
      redirect_uri: REDIRECT
    })
  });
  expect(tokens.status).toBe(200);
  return (await tokens.json()) as { access_token: string };
}

async function beginAuthorize(ctx: OauthCtx): Promise<AuthorizeSession> {
  const clientId = await register(ctx);
  const pkce = makePkce();
  const page = await fetch(authorizeUrl(ctx, clientId, pkce.challenge));
  const html = await page.text();
  expect(page.headers.get("content-security-policy") ?? "").toBe(CONSENT_CSP);
  expect(html).toContain("Connecting…");
  expect(html).toContain("Authorize");
  expect(html).not.toContain("Cursor");
  expect(html).not.toContain("<!--slot:");
  expect(html).toContain(`<title>${PACKAGE_PRODUCT}</title>`);
  const hidden = hiddenFields(html);
  return {
    html,
    csrf: hidden.csrf ?? "",
    cookie: firstCookiePair(page),
    hidden: { ...hidden, challenge_verifier: pkce.verifier, client_id: clientId }
  };
}

async function postConsent(
  ctx: OauthCtx,
  session: AuthorizeSession,
  input: {
    password: string;
    email?: string;
    loginPassword?: string;
    cookie?: boolean | string;
  }
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (input.cookie !== false) {
    headers.cookie = typeof input.cookie === "string" ? input.cookie : session.cookie;
  }
  const body: Record<string, string> = {
    ...session.hidden,
    consent: "1",
    csrf: session.csrf,
    operator_password: input.password
  };
  delete body.challenge_verifier;
  if (input.email !== undefined) body.login_email = input.email;
  if (input.loginPassword !== undefined) body.login_password = input.loginPassword;
  return fetch(`${ctx.origin}/authorize`, {
    method: "POST",
    redirect: "manual",
    headers,
    body: new URLSearchParams(body)
  });
}

async function register(ctx: OauthCtx): Promise<string> {
  const registerRes = await fetch(`${ctx.origin}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "test-grok",
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"]
    })
  });
  return ((await registerRes.json()) as { client_id: string }).client_id;
}

function authorizeUrl(ctx: OauthCtx, clientId: string, challenge: string): URL {
  const url = new URL(`${ctx.origin}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", "mcp:tools");
  url.searchParams.set("state", "state-1");
  return url;
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

function hiddenFields(html: string): Record<string, string> {
  const hidden: Record<string, string> = {};
  const re = /<input type="hidden" name="([^"]+)" value="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) hidden[match[1]] = match[2];
  }
  return hidden;
}

function firstCookiePair(res: Response): string {
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = cookies[0] ?? res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

function mintCsrf(payload: { n: string; exp: number; cid: string; ru: string; ch?: string }): string {
  const encoded = Buffer.from(JSON.stringify({ v: 1, ...payload }), "utf8").toString("base64url");
  const mac = signCsrf(OAUTH_SECRET, `csrf1.${encoded}`);
  return `csrf1.${encoded}.${mac}`;
}
