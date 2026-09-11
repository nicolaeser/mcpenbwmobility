import { createHash, randomBytes } from "node:crypto";
import {
  AUTH_AUDIENCE,
  AUTH_CLIENT_ID,
  AUTH_CUSTOM_SCOPE,
  AUTH_DOMAIN,
  AUTH_REDIRECT_URI,
  AUTH_SCOPE,
  BROWSER_UA
} from "./constants.js";

export interface EmpTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly idToken?: string;
  readonly expiresAt: number;
}

export type FetchFn = typeof fetch;

class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const setCookie =
      typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    const fallback = headers.get("set-cookie");
    const lines = setCookie.length > 0 ? setCookie : fallback !== null ? [fallback] : [];
    for (const line of lines) {
      const pair = line.split(";")[0];
      if (pair === undefined || !pair.includes("=")) continue;
      const eq = pair.indexOf("=");
      this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function b64url(data: Buffer): string {
  return data.toString("base64url");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (part === undefined) return {};
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

export function bsrCount(accessToken: string): number {
  const claims = decodeJwtPayload(accessToken);
  const identity = claims["https://login.ciam.com/identity_v2"] as
    | { businessSystemReferences?: unknown[] }
    | undefined;
  return identity?.businessSystemReferences?.length ?? 0;
}

export function expiresAtFromAccessToken(accessToken: string, fallbackSeconds = 1800): number {
  const exp = decodeJwtPayload(accessToken).exp;
  if (typeof exp === "number") return exp;
  return Math.floor(Date.now() / 1000) + fallbackSeconds;
}

function decodeLoginContext(html: string): { transaction: { state: string } } {
  const match = /atob\("([^"]+)"\)/.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("myEnergyKey login page did not include an Auth0 context.");
  }
  return JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as {
    transaction: { state: string };
  };
}

export async function loginMyEnergyKey(
  email: string,
  password: string,
  fetchImpl: FetchFn = fetch
): Promise<EmpTokens> {
  const jar = new CookieJar();
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  const nonce = b64url(randomBytes(16));
  const authorize = new URL(`${AUTH_DOMAIN}/authorize`);
  authorize.searchParams.set("client_id", AUTH_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", AUTH_REDIRECT_URI);
  authorize.searchParams.set("scope", AUTH_SCOPE);
  authorize.searchParams.set("audience", AUTH_AUDIENCE);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("custom_scope", AUTH_CUSTOM_SCOPE);
  authorize.searchParams.set("viewsignup", "false");

  const ident = await browserGet(fetchImpl, jar, authorize.toString());
  const tx1 = decodeLoginContext(ident.html).transaction.state;
  const passwordPage = await browserPost(
    fetchImpl,
    jar,
    `${AUTH_DOMAIN}/u/login/identifier?state=${encodeURIComponent(tx1)}`,
    {
      state: tx1,
      username: email,
      "js-available": "true",
      "webauthn-available": "true",
      "is-brave": "false",
      "webauthn-platform-available": "false",
      action: "default"
    }
  );
  const tx2 = decodeLoginContext(passwordPage.html).transaction.state;
  let captured = passwordPage.emob;
  if (captured === undefined) {
    const afterPassword = await browserPost(
      fetchImpl,
      jar,
      `${AUTH_DOMAIN}/u/login/password?state=${encodeURIComponent(tx2)}`,
      {
        state: tx2,
        username: email,
        password,
        action: "default"
      }
    );
    captured = afterPassword.emob;
  }
  if (captured === undefined) {
    throw new Error("myEnergyKey login did not return an authorization code.");
  }
  const code = new URL(captured).searchParams.get("code");
  if (code === null || code.length === 0) {
    throw new Error("myEnergyKey login redirect was missing a code.");
  }
  return exchangeCode(fetchImpl, code, verifier);
}

export async function refreshMyEnergyKey(
  refreshToken: string,
  fetchImpl: FetchFn = fetch
): Promise<EmpTokens | undefined> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: AUTH_CLIENT_ID,
    refresh_token: refreshToken,
    custom_scope: AUTH_CUSTOM_SCOPE
  });
  const response = await fetchImpl(`${AUTH_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) return undefined;
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };
  if (json.access_token === undefined || bsrCount(json.access_token) === 0) return undefined;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    ...(json.id_token === undefined ? {} : { idToken: json.id_token }),
    expiresAt: expiresAtFromAccessToken(json.access_token, json.expires_in)
  };
}

async function exchangeCode(fetchImpl: FetchFn, code: string, verifier: string): Promise<EmpTokens> {
  const response = await fetchImpl(`${AUTH_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: AUTH_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: AUTH_REDIRECT_URI
    })
  });
  if (!response.ok) {
    throw new Error(`myEnergyKey token exchange failed (${response.status}).`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };
  if (json.access_token === undefined) {
    throw new Error("myEnergyKey token exchange returned no access token.");
  }
  if (bsrCount(json.access_token) === 0) {
    throw new Error("myEnergyKey login succeeded but mobility account rights were missing.");
  }
  return {
    accessToken: json.access_token,
    ...(json.refresh_token === undefined ? {} : { refreshToken: json.refresh_token }),
    ...(json.id_token === undefined ? {} : { idToken: json.id_token }),
    expiresAt: expiresAtFromAccessToken(json.access_token, json.expires_in)
  };
}

async function browserGet(
  fetchImpl: FetchFn,
  jar: CookieJar,
  url: string
): Promise<{ html: string; emob?: string }> {
  return follow(fetchImpl, jar, url, { method: "GET" });
}

async function browserPost(
  fetchImpl: FetchFn,
  jar: CookieJar,
  url: string,
  form: Record<string, string>
): Promise<{ html: string; emob?: string }> {
  return follow(fetchImpl, jar, url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form)
  });
}

async function follow(
  fetchImpl: FetchFn,
  jar: CookieJar,
  url: string,
  init: RequestInit,
  hops = 0
): Promise<{ html: string; emob?: string }> {
  if (hops > 12) throw new Error("Too many redirects during myEnergyKey login.");
  const headers = new Headers(init.headers);
  headers.set("user-agent", BROWSER_UA);
  headers.set("accept", "text/html,application/xhtml+xml");
  const cookie = jar.header();
  if (cookie.length > 0) headers.set("cookie", cookie);
  const response = await fetchImpl(url, { ...init, headers, redirect: "manual" });
  jar.absorb(response.headers);
  const location = response.headers.get("location");
  if (location !== null && location.startsWith("emob://")) {
    return { html: "", emob: location };
  }
  if (location !== null && response.status >= 300 && response.status < 400) {
    const next = new URL(location, url).toString();
    return follow(fetchImpl, jar, next, { method: "GET" }, hops + 1);
  }
  const html = await response.text();
  return { html };
}
