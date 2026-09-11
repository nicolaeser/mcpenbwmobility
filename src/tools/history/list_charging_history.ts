import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const listChargingHistory = defineTool(
    "enbw_list_charging_history",
    "List charging history",
    "Paginated charging sessions with kWh, costs, station, and timestamps.",
    z.object({
      offset: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().max(50).optional()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        const data = (await ctx.client.listChargingHistory(input.offset ?? 0, input.limit ?? 20)) as {
          chargingHistoryEntries?: unknown[];
        };
        const items = data.chargingHistoryEntries ?? [];
        return listPayload(items, { offset: input.offset ?? 0, limit: input.limit ?? 20, count: items.length });
      })
  );
