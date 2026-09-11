import { z } from "zod";
import { POINTS_PER_VOUCHER } from "../../collect/constants.js";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const redeemCollectPoints = defineTool(
    "enbw_redeem_collect_points",
    "Redeem Collect points",
    "Turn EnBW collect points into 5 € mobility+ voucher codes. Each voucher costs 500 points. Requires confirm: true. Then apply codes with enbw_redeem_voucher or enbw_apply_issued_collect_vouchers.",
    z.object({
      confirm: confirmField,
      voucherCount: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe("Number of 5 € vouchers to issue. Each costs 500 points. Defaults to 1.")
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_redeem_collect_points");
        const count = input.voucherCount ?? 1;
        const points = count * POINTS_PER_VOUCHER;
        const before = await ctx.collect.getBalance();
        if (before.pointsBalance < points) {
          return {
            ok: false,
            reason: "insufficient_points",
            requestedVouchers: count,
            pointsRequired: points,
            ...before
          };
        }
        const issued = [];
        for (let i = 0; i < count; i += 1) {
          issued.push(await ctx.collect.redeemPointsForVoucher(POINTS_PER_VOUCHER));
        }
        const after = await ctx.collect.getBalance();
        return {
          ok: true,
          requestedVouchers: count,
          pointsSpent: points,
          issued,
          balance: after
        };
      }),
    { destructiveHint: true }
  );
