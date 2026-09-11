import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";

export const getChargePoint = defineTool(
    "enbw_get_charge_point",
    "Get charge point",
    "Look up a single EVSE / charge point by evseId, including availability.",
    z.object({ evseId: z.string().min(1) }),
    (ctx, input) =>
      runTool(ctx, async () => ctx.client.getChargePoint(input.evseId))
  );
