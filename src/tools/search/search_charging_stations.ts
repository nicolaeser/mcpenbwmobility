import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";
import { searchInput } from "./helpers.js";

export const searchChargingStations = defineTool(
    "enbw_search_charging_stations",
    "Search charging stations",
    "Search EnBW HyperNetz charging stations around a location. Supports speed, operator, availability, plug type, and related app map filters. Returns pins with availableChargePointCount.",
    searchInput,
    (ctx, input) =>
      runTool(ctx, async () => {
        const raw = (await ctx.client.searchChargingStations(input)) as {
          pins?: unknown[];
          clusters?: unknown[];
        };
        return {
          pins: Array.isArray(raw.pins) ? raw.pins : [],
          clusters: Array.isArray(raw.clusters) ? raw.clusters : [],
          filter: {
            latitude: input.latitude,
            longitude: input.longitude,
            ...(input.minPowerInKw === undefined ? {} : { minPowerInKw: input.minPowerInKw }),
            ...(input.operators === undefined ? {} : { operators: input.operators }),
            ...(input.currentlyAvailable === undefined
              ? {}
              : { currentlyAvailable: input.currentlyAvailable })
          }
        };
      })
  );
