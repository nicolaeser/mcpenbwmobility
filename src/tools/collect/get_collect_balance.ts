import { z } from "zod";
import { POINTS_PER_VOUCHER } from "../../collect/constants.js";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const getCollectBalance = defineTool(
    "enbw_get_collect_balance",
    "Get Collect balance",
    "EnBW collect loyalty points, points still needed for the next 5 € voucher, and how many 5 € vouchers can be issued now.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const [confirmed, balance, account] = await Promise.all([
          ctx.collect.isLoyaltyMembershipConfirmed(),
          ctx.collect.getBalance(),
          ctx.collect.getAccountInfo()
        ]);
        return { membershipConfirmed: confirmed, ...balance, account };
      })
  );
