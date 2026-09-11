import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const applyIssuedCollectVouchers = defineTool(
    "enbw_apply_issued_collect_vouchers",
    "Apply issued Collect vouchers",
    "Take every Issued EnBW collect 5 € voucher code and redeem it into the mobility+ wallet so you do not have to type codes by hand. Requires confirm: true. Codes already in the wallet are skipped.",
    z.object({
      confirm: confirmField
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        requireConfirm(input.confirm, "enbw_apply_issued_collect_vouchers");
        const issued = await ctx.collect.listIssuedVouchers();
        const walletBefore = (await ctx.client.getWallet()) as {
          credits?: Array<{ code?: string; voucherCode?: string }>;
        };
        const already = new Set(
          (walletBefore.credits ?? [])
            .flatMap((credit) => [credit.code, credit.voucherCode])
            .filter((code): code is string => typeof code === "string" && code.length > 0)
        );
        const applied: unknown[] = [];
        const skipped: unknown[] = [];
        const failed: unknown[] = [];
        for (const voucher of issued) {
          const code = voucher.voucherCode;
          if (code === undefined || (voucher.status !== undefined && voucher.status !== "Issued")) {
            skipped.push({ voucher, reason: "not_issued" });
            continue;
          }
          if (already.has(code)) {
            skipped.push({ voucherCode: code, reason: "already_in_wallet" });
            continue;
          }
          try {
            const result = await ctx.client.redeemVoucher(code);
            already.add(code);
            applied.push({ voucherCode: code, faceValue: voucher.faceValue ?? 5, result: result ?? null });
          } catch (error) {
            failed.push({
              voucherCode: code,
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
        const wallet = await ctx.client.getWallet();
        return {
          ok: failed.length === 0,
          applied,
          skipped,
          failed,
          wallet
        };
      })
  );
