import { describe, expect, it } from "vitest";
import { collectLoginBag } from "../auth/fields.js";
import { credentialsFromBag, loginFields } from "../auth/login-fields.js";
import { isAllowedRedirect } from "../auth/redirects.js";

describe("myEnergyKey login fields", () => {
  it("collects email and password as secrets", () => {
    const names = loginFields().map((field) => field.name);
    expect(names).toEqual(["email", "password"]);
    expect(loginFields().every((field) => field.secret === true)).toBe(true);
    const result = collectLoginBag(
      loginFields(),
      { email: "  you@example.com ", password: "  hunter2! " },
      {}
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.bag.secrets.email).toBe("you@example.com");
    expect(result.bag.secrets.password).toBe("hunter2!");
    expect(result.bag.claims).toEqual({});
    expect(credentialsFromBag(result.bag, {})).toEqual({
      email: "you@example.com",
      password: "hunter2!"
    });
  });

  it("fills from ENBW_EMAIL / ENBW_PASSWORD when the form is empty", () => {
    const result = collectLoginBag(loginFields(), {}, {
      ENBW_EMAIL: "env@example.com",
      ENBW_PASSWORD: "env-secret"
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.bag.secrets).toEqual({ email: "env@example.com", password: "env-secret" });
  });
});

describe("redirect allowlist", () => {
  it("allows Grok, Cursor loopback, and the Cursor native callback", () => {
    expect(isAllowedRedirect("https://grok.com/connectors-oauth-exchange-code/")).toBe(true);
    expect(isAllowedRedirect("http://localhost:8787/callback")).toBe(true);
    expect(isAllowedRedirect("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
    expect(isAllowedRedirect("cursor://evil.example/oauth/callback")).toBe(false);
  });
});
