import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const listBookings = defineTool(
    "enbw_list_bookings",
    "List bookings",
    "Accounting bookings (session line items) for the current billing period.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const bookings = await ctx.client.listBookings();
        const items = Array.isArray(bookings) ? bookings : [bookings];
        return listPayload(items);
      })
  );
