import type { FetchFn } from "../emp/auth.js";
import { loginCollect, type CollectSession } from "./auth.js";
import {
  BROWSER_UA,
  COLLECT_APEX_EXECUTE,
  COLLECT_CAMPAIGN_CONTROLLER,
  COLLECT_CONTROLLER,
  EURO_PER_VOUCHER,
  POINTS_PER_VOUCHER
} from "./constants.js";

export interface CollectClientOptions {
  readonly email: string;
  readonly password: string;
  readonly fetch?: FetchFn;
  readonly csrfToken?: string;
  readonly cookieHeader?: string;
}

export class CollectHttpError extends Error {
  public readonly status: number;
  public readonly method: string;
  public constructor(status: number, method: string, message: string) {
    super(message);
    this.name = "CollectHttpError";
    this.status = status;
    this.method = method;
  }
}

export interface CollectBalance {
  readonly pointsBalance: number;
  readonly pointsNeededForNextVoucher: number;
  readonly redeemableVoucherCount: number;
  readonly euroPerVoucher: number;
  readonly pointsPerVoucher: number;
}

export interface CollectIssuedVoucher {
  readonly id?: string;
  readonly name?: string;
  readonly status?: string;
  readonly faceValue?: number;
  readonly voucherCode?: string;
  readonly deepLinkUrl?: string;
  readonly expirationDateTime?: string;
}

export class CollectClient {
  private readonly email: string;
  private readonly password: string;
  private readonly fetchImpl: FetchFn;
  private session: CollectSession | undefined;

  public constructor(options: CollectClientOptions) {
    this.email = options.email;
    this.password = options.password;
    this.fetchImpl = options.fetch ?? fetch;
    if (options.csrfToken !== undefined && options.cookieHeader !== undefined) {
      this.session = {
        csrfToken: options.csrfToken,
        cookieHeader: options.cookieHeader,
        secrets: [options.csrfToken, options.cookieHeader]
      };
    }
  }

  public secretValues(): readonly string[] {
    return [
      this.email,
      this.password,
      ...(this.session === undefined ? [] : this.session.secrets)
    ];
  }

  public async getBalance(): Promise<CollectBalance> {
    const raw = await this.apex<Record<string, unknown>>("getLoyaltyMemberCurrency");
    const pointsBalance = numberField(raw.pointsBalance);
    const pointsNeededForNextVoucher = numberField(raw.pointsNeededForNextVoucher);
    return {
      pointsBalance,
      pointsNeededForNextVoucher,
      redeemableVoucherCount: Math.floor(pointsBalance / POINTS_PER_VOUCHER),
      euroPerVoucher: EURO_PER_VOUCHER,
      pointsPerVoucher: POINTS_PER_VOUCHER
    };
  }

  public getAccountInfo(): Promise<unknown> {
    return this.apex("getAccountInfo");
  }

  public isLoyaltyMembershipConfirmed(): Promise<boolean> {
    return this.apex<boolean>("isLoyaltyMembershipConfirmed");
  }

  public async listIssuedVouchers(): Promise<CollectIssuedVoucher[]> {
    const raw = await this.apex<unknown>("getIssuedVouchers");
    return Array.isArray(raw) ? raw.map(summarizeIssuedVoucher) : [];
  }

  public listLedgers(limitRecords = 200): Promise<unknown> {
    return this.apex("getLatestLoyaltyLedgers", { limitRecords });
  }

  public hasExcludedB2bTariffSessions(): Promise<boolean> {
    return this.apex<boolean>("hasExcludedB2bTariffSessions");
  }

  public fetchCampaigns(): Promise<unknown> {
    return this.apex("fetchCampaigns", {}, COLLECT_CAMPAIGN_CONTROLLER);
  }

  public async redeemPointsForVoucher(points = POINTS_PER_VOUCHER): Promise<CollectIssuedVoucher> {
    if (!Number.isInteger(points) || points < POINTS_PER_VOUCHER || points % POINTS_PER_VOUCHER !== 0) {
      throw new CollectHttpError(
        400,
        "redeemPointsForVoucher",
        `Collect vouchers are issued in ${EURO_PER_VOUCHER} € steps (${POINTS_PER_VOUCHER} points each).`
      );
    }
    const raw = await this.apex<Record<string, unknown>>("redeemPointsForVoucher", { points });
    return summarizeIssuedVoucher(raw);
  }

  private async apex<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    classname = COLLECT_CONTROLLER
  ): Promise<T> {
    const session = await this.ensureSession();
    const response = await this.fetchImpl(COLLECT_APEX_EXECUTE, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": BROWSER_UA,
        cookie: session.cookieHeader,
        "csrf-token": session.csrfToken,
        "x-sfdc-csrf-token": session.csrfToken
      },
      body: JSON.stringify({
        namespace: "",
        classname,
        method,
        isContinuation: false,
        params,
        cacheable: false
      })
    });
    const text = await response.text();
    if (response.status === 401) {
      this.session = undefined;
      throw new CollectHttpError(
        401,
        method,
        "EnBW collect rejected the Salesforce session. Re-authorize with myEnergyKey email and password."
      );
    }
    const parsed = parseJson(text);
    if (!response.ok) {
      throw new CollectHttpError(response.status, method, apexErrorMessage(parsed, response.status));
    }
    if (parsed !== null && typeof parsed === "object" && "returnValue" in parsed) {
      return (parsed as { returnValue: T }).returnValue;
    }
    return parsed as T;
  }

  private async ensureSession(): Promise<CollectSession> {
    if (this.session !== undefined) return this.session;
    this.session = await loginCollect(this.email, this.password, this.fetchImpl);
    return this.session;
  }
}

function numberField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function summarizeIssuedVoucher(value: unknown): CollectIssuedVoucher {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const built: {
    id?: string;
    name?: string;
    status?: string;
    faceValue?: number;
    voucherCode?: string;
    deepLinkUrl?: string;
    expirationDateTime?: string;
  } = {};
  const id = stringField(row.Id ?? row.id);
  const name = stringField(row.Name ?? row.name);
  const status = stringField(row.Status ?? row.status);
  const faceValue = numberOrUndefined(row.FaceValue ?? row.faceValue);
  const voucherCode = stringField(row.VoucherCode ?? row.voucherCode);
  const deepLinkUrl = stringField(row.DeepLinkUrl__c ?? row.deepLinkUrl);
  const expirationDateTime = stringField(row.ExpirationDateTime ?? row.expirationDateTime);
  if (id !== undefined) built.id = id;
  if (name !== undefined) built.name = name;
  if (status !== undefined) built.status = status;
  if (faceValue !== undefined) built.faceValue = faceValue;
  if (voucherCode !== undefined) built.voucherCode = voucherCode;
  if (deepLinkUrl !== undefined) built.deepLinkUrl = deepLinkUrl;
  if (expirationDateTime !== undefined) built.expirationDateTime = expirationDateTime;
  return built;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function parseJson(text: string): unknown {
  if (text.trim() === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 400) };
  }
}

function apexErrorMessage(parsed: unknown, status: number): string {
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const errors = (parsed as { error?: unknown }).error;
    if (Array.isArray(errors) && errors[0] !== undefined && typeof errors[0] === "object" && errors[0] !== null) {
      const message = (errors[0] as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  }
  return `EnBW collect API error (${status}).`;
}

export type CollectClientFactory = (options: CollectClientOptions) => CollectClient;

export function defaultCollectClientFactory(options: CollectClientOptions): CollectClient {
  return new CollectClient(options);
}
