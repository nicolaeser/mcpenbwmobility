import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { filePayload, listPayload } from "../../mcp/format.js";

export const getInvoiceDocument = defineTool(
    "enbw_get_invoice_document",
    "Get invoice document",
    "Download an invoice PDF (base64) by document id from the invoice list.",
    z.object({ documentId: z.union([z.string(), z.number()]) }),
    (ctx, input) =>
      runTool(ctx, async () => {
        const file = (await ctx.client.getInvoiceDocument(input.documentId)) as {
          filename?: string;
          mimeType?: string;
          base64Encoded?: boolean;
          content?: string | null;
        };
        return filePayload(file, { documentId: input.documentId });
      })
  );
