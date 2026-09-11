import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, requireConfirm } from "../../mcp/format.js";

export const stopCharging = defineTool(
    "enbw_stop_charging",
    "Stop charging",
    "Remote-stop a charging session. Live infrastructure. Requires confirm: true.",
    z.object({
      confirm: confirmField,
      transactionId: z.string().min(1)
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_stop_charging");
        const result = await ctx.client.stopCharging(input.transactionId);
        return { ok: true, transactionId: input.transactionId, result: result ?? null };
      })
  );
