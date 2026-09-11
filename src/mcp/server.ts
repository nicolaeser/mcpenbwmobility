import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MissingTokenError } from "../errors.js";
import { toolError } from "./format.js";
import { TOOL_CATALOG } from "./catalog.js";
import type { LoginBag } from "../auth/fields.js";
import { credentialsFromBag } from "../auth/login-fields.js";
import {
  defaultCollectClientFactory,
  type CollectClient,
  type CollectClientFactory
} from "../collect/client.js";
import { defaultClientFactory, type EmpClient, type EmpClientFactory } from "../emp/client.js";
import type { ToolContext } from "../types.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../version.js";

export interface McpServerOptions {
  readonly getToken: () => string | undefined;
  readonly getBag?: () => LoginBag;
  readonly createClient?: EmpClientFactory;
  readonly createCollectClient?: CollectClientFactory;
  readonly email?: string;
  readonly password?: string;
}

export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    { capabilities: { tools: {} } }
  );
  let sharedClient: EmpClient | undefined;
  let sharedCollect: CollectClient | undefined;
  const factory = options.createClient ?? defaultClientFactory;
  const collectFactory = options.createCollectClient ?? defaultCollectClientFactory;

  for (const entry of TOOL_CATALOG) {
    const config = {
      title: entry.title,
      description: entry.description,
      inputSchema: schemaShape(entry.inputSchema),
      annotations: entry.annotations
    };
    const callback = async (args: Record<string, unknown> | undefined) => {
      let ctx: ToolContext | undefined;
      try {
        ctx = createToolContext(
          options,
          factory,
          collectFactory,
          () => sharedClient,
          (client) => {
            sharedClient = client;
          },
          () => sharedCollect,
          (client) => {
            sharedCollect = client;
          }
        );
        return await entry.handler(ctx, args ?? {});
      } catch (error) {
        return toolError(error, ctx?.secrets ?? []);
      }
    };
    server.registerTool(entry.name, config, callback as never);
  }

  return server;
}

function createToolContext(
  options: McpServerOptions,
  factory: EmpClientFactory,
  collectFactory: CollectClientFactory,
  getShared: () => EmpClient | undefined,
  setShared: (client: EmpClient) => void,
  getSharedCollect: () => CollectClient | undefined,
  setSharedCollect: (client: CollectClient) => void
): ToolContext {
  const token = options.getToken();
  if (token === undefined || token.length === 0) {
    throw new MissingTokenError();
  }
  const bag = options.getBag?.() ?? { secrets: { password: token }, claims: {} };
  const creds = credentialsFromBag(bag, {
    ...(options.email === undefined ? {} : { email: options.email }),
    ...(options.password === undefined ? {} : { password: options.password })
  });
  if (creds === undefined) {
    throw new MissingTokenError();
  }
  let client = getShared();
  if (client === undefined) {
    client = factory({ email: creds.email, password: creds.password });
    setShared(client);
  }
  let collect = getSharedCollect();
  if (collect === undefined) {
    collect = collectFactory({ email: creds.email, password: creds.password });
    setSharedCollect(collect);
  }
  return {
    client,
    collect,
    bag,
    secrets: uniqueSecrets([
      token,
      creds.email,
      creds.password,
      ...client.secretValues(),
      ...collect.secretValues()
    ])
  };
}

function uniqueSecrets(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function schemaShape(schema: z.ZodTypeAny): z.ZodRawShape {
  if (schema instanceof z.ZodObject) {
    return schema.shape as z.ZodRawShape;
  }
  return {};
}
