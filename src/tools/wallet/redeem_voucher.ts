import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const redeemVoucher = defineTool(
    "enbw_redeem_voucher",
    "Redeem voucher",
    "Apply a charging-credit voucher code in the EnBW mobility+ app wallet. Requires confirm: true. Use this for Collect 5 € codes after enbw_redeem_collect_points.",
    z.object({
      confirm: confirmField,
      voucherCode: z.string().min(1).describe("Code from Collect or another EnBW mobility+ voucher.")
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_redeem_voucher");
        const result = await ctx.client.redeemVoucher(input.voucherCode);
        const wallet = await ctx.client.getWallet();
        return { ok: true, voucherCode: input.voucherCode, result: result ?? null, wallet };
      })
  );
