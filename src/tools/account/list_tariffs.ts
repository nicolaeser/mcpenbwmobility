import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const listTariffs = defineTool(
    "enbw_list_tariffs",
    "List tariffs",
    "Available EnBW mobility+ charging tariffs.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const tariffs = await ctx.client.listTariffs();
        const items = Array.isArray(tariffs) ? tariffs : [tariffs];
        return listPayload(items);
      })
  );
