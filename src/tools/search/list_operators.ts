import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";
import { searchInput } from "./helpers.js";

export const listOperators = defineTool(
    "enbw_list_operators",
    "List operators",
    "List charging station operators for provider filtering.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const operators = await ctx.client.listOperators();
        if (
          operators !== null &&
          typeof operators === "object" &&
          Array.isArray((operators as { operators?: unknown }).operators)
        ) {
          return listPayload((operators as { operators: unknown[] }).operators);
        }
        const items = Array.isArray(operators) ? operators : [operators];
        return listPayload(items);
      })
  );
