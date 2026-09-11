import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";
import { listPayload } from "../../mcp/format.js";

export const getActiveCharging = defineTool(
    "enbw_get_active_charging",
    "Get active charging",
    "Current in-progress charging sessions, if any.",
    z.object({}),
    (ctx) => runTool(ctx, async () => ctx.client.getActiveCharging())
  );
