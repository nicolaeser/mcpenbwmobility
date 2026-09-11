import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const listChargeCards = defineTool(
    "enbw_list_charge_cards",
    "List charge cards",
    "RFID / charging cards on the account.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const cards = await ctx.client.listChargeCards();
        const items = Array.isArray(cards) ? cards : [cards];
        return listPayload(items);
      })
  );
