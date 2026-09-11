import { z } from "zod";
import { POINTS_PER_VOUCHER } from "../../collect/constants.js";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { confirmField, listPayload, requireConfirm } from "../../mcp/format.js";

export const listCollectHistory = defineTool(
    "enbw_list_collect_history",
    "List Collect history",
    "EnBW collect points ledger (accruals, promotions, and voucher redemptions).",
    z.object({
      limit: z.number().int().positive().max(200).optional()
    }),
    (ctx, input) =>
      runTool(ctx, async () => {
        const [ledgers, excludedB2b] = await Promise.all([
          ctx.collect.listLedgers(input.limit ?? 200),
          ctx.collect.hasExcludedB2bTariffSessions()
        ]);
        const items = Array.isArray(ledgers) ? ledgers : [ledgers];
        return listPayload(items, { excludedB2bTariffSessions: excludedB2b });
      })
  );
