export interface ChargePointSearchInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm?: number | undefined;
  readonly minPowerInKw?: number | undefined;
  readonly maxPowerInKw?: number | undefined;
  readonly operators?: readonly string[] | undefined;
  readonly currentlyAvailable?: boolean | undefined;
  readonly alwaysOpen?: boolean | undefined;
  readonly plugTypes?: readonly string[] | undefined;
  readonly freeCharging?: boolean | undefined;
  readonly handicappedAccessible?: boolean | undefined;
  readonly authenticationMethods?: readonly string[] | undefined;
  readonly minChargingPoints?: number | undefined;
  readonly priceLimit?: number | undefined;
  readonly includeOtherOperators?: boolean | undefined;
  readonly maxResults?: number | undefined;
}

export function boundingBox(lat: number, lon: number, radiusKm: number): {
  fromLat: number;
  toLat: number;
  fromLon: number;
  toLon: number;
} {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return {
    fromLat: lat - latDelta,
    toLat: lat + latDelta,
    fromLon: lon - lonDelta,
    toLon: lon + lonDelta
  };
}

export function mapSearchQuery(input: ChargePointSearchInput): Record<string, string> {
  const radius = input.radiusKm ?? 5;
  const box = boundingBox(input.latitude, input.longitude, radius);
  const query: Record<string, string> = {
    fromLat: String(Math.min(box.fromLat, box.toLat)),
    toLat: String(Math.max(box.fromLat, box.toLat)),
    fromLon: String(Math.min(box.fromLon, box.toLon)),
    toLon: String(Math.max(box.fromLon, box.toLon)),
    myLat: String(input.latitude),
    myLon: String(input.longitude),
    useFilter: "false",
    grouping: "false",
    maxResults: String(input.maxResults ?? 50)
  };
  return query;
}

export function chargePointFilterBody(input: ChargePointSearchInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    presetSelected: 0,
    presetPlugTypes: {},
    includeOtherOperators: input.includeOtherOperators ?? true,
    minimumNumberOfChargingPoints: input.minChargingPoints ?? 0
  };
  if (input.minPowerInKw !== undefined) body.minPowerInKw = input.minPowerInKw;
  if (input.maxPowerInKw !== undefined) body.maxPowerInKw = input.maxPowerInKw;
  if (input.currentlyAvailable !== undefined) body.currentlyAvailable = input.currentlyAvailable;
  if (input.alwaysOpen !== undefined) body.alwaysOpen = input.alwaysOpen;
  if (input.operators !== undefined) body.operators = [...input.operators];
  if (input.plugTypes !== undefined) body.plugTypes = [...input.plugTypes];
  if (input.freeCharging !== undefined) body.freeCharging = input.freeCharging;
  if (input.handicappedAccessible !== undefined) body.handicappedAccessible = input.handicappedAccessible;
  if (input.authenticationMethods !== undefined) {
    body.authenticationMethods = [...input.authenticationMethods];
  }
  if (input.priceLimit !== undefined) body.priceLimit = input.priceLimit;
  return body;
}
