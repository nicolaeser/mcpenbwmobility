import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const listFavorites = defineTool(
    "enbw_list_favorites",
    "List favorite stations",
    "Favorite charging stations. Optional location for distance.",
    z.object({
      latitude: z.number().optional(),
      longitude: z.number().optional()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        const favorites = await ctx.client.listFavorites(input.latitude, input.longitude);
        if (favorites !== null && typeof favorites === "object" && Array.isArray((favorites as { favorites?: unknown }).favorites)) {
          return listPayload((favorites as { favorites: unknown[] }).favorites);
        }
        const items = Array.isArray(favorites) ? favorites : [favorites];
        return listPayload(items);
      })
  );
