import { z } from "zod";
import { defineTool, runTool } from "../../mcp/define-tool.js";

export const getProfile = defineTool(
    "enbw_get_profile",
    "Get profile",
    "Account overview including current-month turnover and last invoice amount. Never returns login secrets.",
    z.object({}),
    (ctx) =>
      runTool(ctx, async () => {
        const [profile, userData, profiles] = await Promise.all([
          ctx.client.getProfile(),
          ctx.client.getUserData(),
          ctx.client.listProfiles()
        ]);
        return { profile, userData, profiles };
      })
  );
