import { randomUUID } from "node:crypto";
import { bsrCount, expiresAtFromAccessToken, loginMyEnergyKey, refreshMyEnergyKey, type EmpTokens, type FetchFn } from "./auth.js";
import {
  EMP_API_BASE,
  EMP_APP_VERSION,
  EMP_SUBSCRIPTION_KEY,
  EMP_VERSION_CODE,
  OKHTTP_UA
} from "./constants.js";
import { chargePointFilterBody, mapSearchQuery, type ChargePointSearchInput } from "./filters.js";

export interface EmpClientOptions {
  readonly email: string;
  readonly password: string;
  readonly fetch?: FetchFn;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly apiBase?: string;
}

export class EmpHttpError extends Error {
  public readonly status: number;
  public readonly path: string;
  public constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "EmpHttpError";
    this.status = status;
    this.path = path;
  }
}

export class EmpClient {
  private readonly email: string;
  private readonly password: string;
  private readonly fetchImpl: FetchFn;
  private readonly apiBase: string;
  private tokens: EmpTokens | undefined;

  public constructor(options: EmpClientOptions) {
    this.email = options.email;
    this.password = options.password;
    this.fetchImpl = options.fetch ?? fetch;
    this.apiBase = options.apiBase ?? EMP_API_BASE;
    if (options.accessToken !== undefined) {
      this.tokens = {
        accessToken: options.accessToken,
        ...(options.refreshToken === undefined ? {} : { refreshToken: options.refreshToken }),
        expiresAt: expiresAtFromAccessToken(options.accessToken)
      };
    }
  }

  public secretValues(): readonly string[] {
    const tokens = this.tokens;
    return [
      this.email,
      this.password,
      ...(tokens === undefined
        ? []
        : [tokens.accessToken, tokens.refreshToken, tokens.idToken].filter(
            (value): value is string => value !== undefined && value.length > 0
          ))
    ];
  }

  public async request<T = unknown>(
    method: string,
    path: string,
    options: {
      readonly query?: Record<string, string | number | undefined>;
      readonly json?: unknown;
      readonly raw?: boolean;
    } = {}
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const url = new URL(path.replace(/^\//, ""), this.apiBase);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: options.raw === true ? "*/*" : "application/json",
      "ocp-apim-subscription-key": EMP_SUBSCRIPTION_KEY,
      "user-agent": OKHTTP_UA,
      "accept-language": "de",
      platform: "Android",
      appVersion: EMP_APP_VERSION,
      osVersion: "34",
      versionCode: EMP_VERSION_CODE,
      deviceModel: "Pixel 8",
      installationIdentifier: randomUUID()
    };
    const init: RequestInit = { method, headers };
    if (options.json !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.json);
    }
    const response = await this.fetchImpl(url.toString(), init);
    if (!response.ok) {
      const text = await response.text();
      throw new EmpHttpError(
        response.status,
        `${method} ${url.pathname}${url.search}`,
        empErrorMessage(response.status, text)
      );
    }
    if (options.raw === true) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        filename: filenameFromDisposition(response.headers.get("content-disposition")),
        mimeType: response.headers.get("content-type") ?? "application/octet-stream",
        base64Encoded: true,
        content: buffer.toString("base64")
      } as T;
    }
    const text = await response.text();
    if (text.trim() === "") return undefined as T;
    return JSON.parse(text) as T;
  }

  public searchChargingStations(input: ChargePointSearchInput): Promise<unknown> {
    return this.request("POST", "v1/mapsearch", {
      query: mapSearchQuery(input),
      json: chargePointFilterBody(input)
    });
  }

  public getChargingStation(
    stationId: number,
    options: { latitude?: number; longitude?: number; minPowerInKw?: number; maxPowerInKw?: number; plugTypes?: readonly string[] } = {}
  ): Promise<unknown> {
    const query: Record<string, string | number | undefined> = {};
    if (options.latitude !== undefined) query.myLat = options.latitude;
    if (options.longitude !== undefined) query.myLon = options.longitude;
    const json: Record<string, unknown> = {};
    if (options.minPowerInKw !== undefined) json.minPowerInKw = options.minPowerInKw;
    if (options.maxPowerInKw !== undefined) json.maxPowerInKw = options.maxPowerInKw;
    if (options.plugTypes !== undefined) json.plugTypes = [...options.plugTypes];
    return this.request("POST", `v3/chargestations/${stationId}`, { query, json });
  }

  public getChargingPoints(stationId: number): Promise<unknown> {
    return this.request("GET", `v3/chargestations/${stationId}/chargingpoints`);
  }

  public getChargePoint(evseId: string): Promise<unknown> {
    return this.request("GET", `v1/charge/${encodeURIComponent(evseId)}`);
  }

  public listChargingHistory(offset = 0, limit = 20): Promise<unknown> {
    return this.request("GET", "v2/chargings/history", { query: { offset, limit } });
  }

  public getActiveCharging(): Promise<unknown> {
    return this.request("GET", "v2/chargings/active");
  }

  public listInvoices(): Promise<unknown> {
    return this.request("GET", "v1/accounting/invoice/list");
  }

  public getInvoiceDocument(documentId: string | number): Promise<unknown> {
    return this.request("GET", `v1/accounting/invoice/document/${documentId}`, { raw: true });
  }

  public listBookings(): Promise<unknown> {
    return this.request("GET", "v1/accounting/bookings");
  }

  public getProfile(): Promise<unknown> {
    return this.request("GET", "v1/users/profile");
  }

  public getUserData(): Promise<unknown> {
    return this.request("GET", "v1/users/userdata");
  }

  public listProfiles(): Promise<unknown> {
    return this.request("GET", "v1/profiles");
  }

  public listTariffs(): Promise<unknown> {
    return this.request("GET", "v2/tariffs");
  }

  public listChargeCards(): Promise<unknown> {
    return this.request("GET", "v1/chargecard/list");
  }

  public listFavorites(latitude?: number, longitude?: number): Promise<unknown> {
    return this.request("GET", "v2/chargestations/favorites", {
      query: {
        ...(latitude === undefined ? {} : { myLat: latitude }),
        ...(longitude === undefined ? {} : { myLon: longitude })
      }
    });
  }

  public listOperators(): Promise<unknown> {
    return this.request("GET", "v1/operators");
  }

  public addFavorite(stationId: number): Promise<unknown> {
    return this.request("POST", "v1/chargestations/favorites", { json: { stationId } });
  }

  public removeFavorite(stationId: number): Promise<unknown> {
    return this.request("DELETE", `v1/chargestations/favorites/${stationId}`);
  }

  public startCharging(evseId: string, chargePlugTypeGroup: string): Promise<unknown> {
    return this.request("POST", "v1/chargings/start", {
      json: { evseId, chargePlugTypeGroup }
    });
  }

  public stopCharging(transactionId: string): Promise<unknown> {
    return this.request("POST", "v1/chargings/stop", { json: { transactionId } });
  }

  public getWallet(): Promise<unknown> {
    return this.request("GET", "v2/voucher/wallet");
  }

  public listCredits(): Promise<unknown> {
    return this.request("GET", "v1/voucher/wallet");
  }

  public redeemVoucher(voucherCode: string): Promise<unknown> {
    return this.request("POST", "v1/voucher/redeem", { json: { voucherCode } });
  }

  private async ensureAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokens !== undefined && this.tokens.expiresAt - 60 > now) {
      return this.tokens.accessToken;
    }
    if (this.tokens?.refreshToken !== undefined) {
      const refreshed = await refreshMyEnergyKey(this.tokens.refreshToken, this.fetchImpl);
      if (refreshed !== undefined && bsrCount(refreshed.accessToken) > 0) {
        this.tokens = refreshed;
        return refreshed.accessToken;
      }
    }
    this.tokens = await loginMyEnergyKey(this.email, this.password, this.fetchImpl);
    return this.tokens.accessToken;
  }
}

function empErrorMessage(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "EnBW rejected the mobility session. Re-authorize with myEnergyKey email and password.";
  }
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return `EnBW API error (${status}): ${parsed.message}`;
    }
  } catch {
  }
  return `EnBW API error (${status}).`;
}

function filenameFromDisposition(header: string | null): string {
  if (header === null) return "document.bin";
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1] !== undefined) return decodeURIComponent(utf[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? "document.bin";
}

export type EmpClientFactory = (options: EmpClientOptions) => EmpClient;

export function defaultClientFactory(options: EmpClientOptions): EmpClient {
  return new EmpClient(options);
}
