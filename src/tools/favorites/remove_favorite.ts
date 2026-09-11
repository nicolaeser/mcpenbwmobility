import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const removeFavorite = defineTool(
    "enbw_remove_favorite",
    "Remove favorite station",
    "Remove a favorite charging station. Requires confirm: true.",
    z.object({
      confirm: confirmField,
      stationId: z.number().int().positive()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_remove_favorite");
        await ctx.client.removeFavorite(input.stationId);
        return { ok: true, stationId: input.stationId };
      })
  );
