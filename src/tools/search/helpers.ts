import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const searchInput = z.object({
  latitude: z.number().describe("Center latitude (WGS84)"),
  longitude: z.number().describe("Center longitude (WGS84)"),
  radiusKm: z.number().positive().optional().describe("Search radius in km, default 5"),
  minPowerInKw: z.number().nonnegative().optional(),
  maxPowerInKw: z.number().positive().optional(),
  operators: z.array(z.string()).optional().describe("Operator names as used by EnBW, e.g. EnBW"),
  currentlyAvailable: z.boolean().optional().describe("Only stations with a free point"),
  alwaysOpen: z.boolean().optional(),
  plugTypes: z.array(z.string()).optional().describe("e.g. CCS, TYPE2, CHADEMO"),
  freeCharging: z.boolean().optional(),
  handicappedAccessible: z.boolean().optional(),
  authenticationMethods: z.array(z.string()).optional(),
  minChargingPoints: z.number().int().nonnegative().optional(),
  priceLimit: z.number().nonnegative().optional(),
  includeOtherOperators: z.boolean().optional(),
  maxResults: z.number().int().positive().max(200).optional()
});
