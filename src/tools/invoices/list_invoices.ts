import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { filePayload, listPayload } from "../../mcp/format.js";

export const listInvoices = defineTool(
    "enbw_list_invoices",
    "List invoices",
    "Official EnBW mobility+ invoices with billing periods and amounts.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const invoices = await ctx.client.listInvoices();
        const items = Array.isArray(invoices) ? invoices : [invoices];
        return listPayload(items);
      })
  );
