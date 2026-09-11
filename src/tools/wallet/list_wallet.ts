import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const listWallet = defineTool(
    "enbw_list_wallet",
    "List wallet",
    "mobility+ charging credits and discount vouchers already on the account (Gutscheine & Guthaben).",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const wallet = await ctx.client.getWallet();
        return wallet ?? { credits: [], discounts: [] };
      })
  );
