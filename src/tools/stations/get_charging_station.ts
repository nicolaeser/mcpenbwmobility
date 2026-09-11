import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";

export const getChargingStation = defineTool(
    "enbw_get_charging_station",
    "Get charging station",
    "Station detail plus live charging-point availability (state.value: AVAILABLE, OCCUPIED, UNKNOWN, …).",
    z.object({
      stationId: z.number().int().positive(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      minPowerInKw: z.number().nonnegative().optional(),
      maxPowerInKw: z.number().positive().optional(),
      plugTypes: z.array(z.string()).optional()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        const [station, points] = await Promise.all([
          ctx.client.getChargingStation(input.stationId, {
            ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
            ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
            ...(input.minPowerInKw === undefined ? {} : { minPowerInKw: input.minPowerInKw }),
            ...(input.maxPowerInKw === undefined ? {} : { maxPowerInKw: input.maxPowerInKw }),
            ...(input.plugTypes === undefined ? {} : { plugTypes: input.plugTypes })
          }),
          ctx.client.getChargingPoints(input.stationId)
        ]);
        const pointList =
          points !== null &&
          typeof points === "object" &&
          Array.isArray((points as { chargePoints?: unknown }).chargePoints)
            ? (points as { chargePoints: Array<Record<string, unknown>> }).chargePoints
            : [];
        return {
          station,
          points: pointList.map(summarizePoint),
          availability: summarizeAvailability(pointList)
        };
      })
  );

function summarizePoint(point: Record<string, unknown>): Record<string, unknown> {
  const state = point.state as { value?: string; updatedAt?: number } | undefined;
  return {
    evseId: point.evseId ?? point.id,
    chargingPoleNumber: point.chargingPoleNumber,
    status: state?.value ?? null,
    statusUpdatedAt: state?.updatedAt ?? null,
    handicappedAccessible: point.handicappedAccessible,
    connectors: point.connectors
  };
}

function summarizeAvailability(points: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = { total: points.length };
  for (const point of points) {
    const value =
      ((point.state as { value?: string } | undefined)?.value ?? "UNKNOWN").toUpperCase();
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
