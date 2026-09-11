import type { FetchFn } from "../emp/auth.js";
import { AUTH_DOMAIN, BROWSER_UA, COLLECT_LOGIN_URL, COLLECT_ORIGIN, COLLECT_USER_MODULE } from "./constants.js";

export interface CollectSession {
  readonly csrfToken: string;
  readonly cookieHeader: string;
  readonly userId?: string;
  readonly secrets: readonly string[];
}

class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(headers: Headers, url: string): void {
    const host = new URL(url).hostname;
    const setCookie = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    const fallback = headers.get("set-cookie");
    const lines = setCookie.length > 0 ? setCookie : fallback !== null ? [fallback] : [];
    for (const line of lines) {
      const pair = line.split(";")[0];
      if (pair === undefined || !pair.includes("=")) continue;
      const eq = pair.indexOf("=");
      this.cookies.set(`${host}\t${pair.slice(0, eq)}`, pair.slice(eq + 1));
    }
  }

  header(url: string): string {
    const host = new URL(url).hostname;
    const parts: string[] = [];
    for (const [key, value] of this.cookies.entries()) {
      const [cookieHost, name] = key.split("\t");
      if (cookieHost === undefined || name === undefined) continue;
      if (host === cookieHost || host.endsWith(`.${cookieHost}`) || cookieHost.endsWith(`.${host}`)) {
        parts.push(`${name}=${value}`);
      }
    }
    return [...new Set(parts)].join("; ");
  }

  secretValues(): string[] {
    return [...this.cookies.values()].filter((value) => value.length > 0);
  }
}

interface BrowserPage {
  readonly url: string;
  readonly status: number;
  readonly html: string;
}

function decodeLoginContext(html: string): { transaction: { state: string } } {
  const match = /atob\("([^"]+)"\)/.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("myEnergyKey Collect login page did not include an Auth0 context.");
  }
  return JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as {
    transaction: { state: string };
  };
}

export async function loginCollect(
  email: string,
  password: string,
  fetchImpl: FetchFn = fetch
): Promise<CollectSession> {
  const jar = new CookieJar();
  const start = await follow(fetchImpl, jar, COLLECT_LOGIN_URL);
  let page = await completeMyEnergyKey(fetchImpl, jar, start.html, email, password);
  page = await followJsRedirects(fetchImpl, jar, page);
  const userPage = await follow(fetchImpl, jar, COLLECT_USER_MODULE);
  const user = parseUserModule(userPage.html);
  if (user.isGuest === true || user.csrfToken === null || user.csrfToken.length === 0) {
    throw new Error("EnBW collect login did not establish a Salesforce session.");
  }
  const cookieHeader = jar.header(COLLECT_ORIGIN);
  return {
    csrfToken: user.csrfToken,
    cookieHeader,
    secrets: [...new Set([user.csrfToken, cookieHeader, ...jar.secretValues()].filter((value) => value.length > 0))],
    ...(user.id === null ? {} : { userId: user.id })
  };
}

async function completeMyEnergyKey(
  fetchImpl: FetchFn,
  jar: CookieJar,
  identifierHtml: string,
  email: string,
  password: string
): Promise<BrowserPage> {
  const tx1 = decodeLoginContext(identifierHtml).transaction.state;
  const passwordPage = await follow(
    fetchImpl,
    jar,
    `${AUTH_DOMAIN}/u/login/identifier?state=${encodeURIComponent(tx1)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        state: tx1,
        username: email,
        "js-available": "true",
        "webauthn-available": "true",
        "is-brave": "false",
        "webauthn-platform-available": "false",
        action: "default"
      })
    }
  );
  const tx2 = decodeLoginContext(passwordPage.html).transaction.state;
  return follow(fetchImpl, jar, `${AUTH_DOMAIN}/u/login/password?state=${encodeURIComponent(tx2)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      state: tx2,
      username: email,
      password,
      action: "default"
    })
  });
}

async function followJsRedirects(
  fetchImpl: FetchFn,
  jar: CookieJar,
  page: BrowserPage,
  hops = 0
): Promise<BrowserPage> {
  if (hops > 8) return page;
  const next =
    /window\.location\.replace\('([^']+)'\)/.exec(page.html)?.[1] ??
    /window\.location\.href\s*=\s*'([^']+)'/.exec(page.html)?.[1] ??
    /URL=([^"' >]+)/.exec(page.html)?.[1];
  if (next === undefined) return page;
  const resolved = new URL(next.replace(/&amp;/g, "&"), page.url).toString();
  const followed = await follow(fetchImpl, jar, resolved);
  return followJsRedirects(fetchImpl, jar, followed, hops + 1);
}

async function follow(
  fetchImpl: FetchFn,
  jar: CookieJar,
  url: string,
  init: RequestInit = {},
  hops = 0
): Promise<BrowserPage> {
  if (hops > 16) throw new Error("Too many redirects during EnBW collect login.");
  const headers = new Headers(init.headers);
  headers.set("user-agent", BROWSER_UA);
  if (!headers.has("accept")) headers.set("accept", "text/html,application/xhtml+xml");
  const cookie = jar.header(url);
  if (cookie.length > 0) headers.set("cookie", cookie);
  const response = await fetchImpl(url, { ...init, headers, redirect: "manual" });
  jar.absorb(response.headers, url);
  const location = response.headers.get("location");
  if (location !== null && response.status >= 300 && response.status < 400) {
    return follow(fetchImpl, jar, new URL(location, url).toString(), { method: "GET" }, hops + 1);
  }
  return { url, status: response.status, html: await response.text() };
}

function parseUserModule(html: string): {
  isGuest: boolean;
  id: string | null;
  csrfToken: string | null;
} {
  const match = /return (\{.*?\}); \}\);/s.exec(html);
  if (match?.[1] === undefined) {
    throw new Error("EnBW collect user module was missing.");
  }
  const parsed = JSON.parse(match[1]) as {
    isGuest?: boolean;
    id?: string | null;
    csrfToken?: string | null;
  };
  return {
    isGuest: parsed.isGuest === true,
    id: parsed.id ?? null,
    csrfToken: parsed.csrfToken ?? null
  };
}
