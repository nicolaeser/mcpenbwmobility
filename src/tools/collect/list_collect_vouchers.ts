import { z } from "zod";
import { POINTS_PER_VOUCHER } from "../../collect/constants.js";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const listCollectVouchers = defineTool(
    "enbw_list_collect_vouchers",
    "List Collect vouchers",
    "5 € charging-credit voucher codes issued from EnBW collect. Enter them in mobility+ with enbw_redeem_voucher, or apply all issued codes with enbw_apply_issued_collect_vouchers.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const items = await ctx.collect.listIssuedVouchers();
        return listPayload(items);
      })
  );
