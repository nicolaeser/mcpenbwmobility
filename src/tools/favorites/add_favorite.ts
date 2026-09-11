import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const addFavorite = defineTool(
    "enbw_add_favorite",
    "Add favorite station",
    "Save a charging station as favorite. Requires confirm: true.",
    z.object({
      confirm: confirmField,
      stationId: z.number().int().positive()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_add_favorite");
        await ctx.client.addFavorite(input.stationId);
        return { ok: true, stationId: input.stationId };
      })
  );
