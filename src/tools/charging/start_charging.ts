import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, requireConfirm } from "../../mcp/format.js";

export const startCharging = defineTool(
    "enbw_start_charging",
    "Start charging",
    "Remote-start a charging session at an EVSE. Live infrastructure. Requires confirm: true.",
    z.object({
      confirm: confirmField,
      evseId: z.string().min(1),
      chargePlugTypeGroup: z.string().min(1).describe("e.g. CCS or TYPE2")
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_start_charging");
        const result = await ctx.client.startCharging(input.evseId, input.chargePlugTypeGroup);
        return { ok: true, evseId: input.evseId, result: result ?? null };
      })
  );
