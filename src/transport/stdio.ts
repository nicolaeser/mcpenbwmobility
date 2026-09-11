import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readRuntimeConfig } from "../config.js";
import { createMcpServer } from "../mcp/server.js";
import type { EmpClientFactory } from "../emp/client.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../version.js";

export interface StdioRunOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly createClient?: EmpClientFactory;
}

export async function runStdio(options: StdioRunOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const config = readRuntimeConfig(env);
  const email = config.email;
  const password = config.password;
  const token = password;
  const server = createMcpServer({
    getToken: () => token,
    getBag: () => ({
      secrets: {
        ...(email === undefined ? {} : { email }),
        ...(password === undefined ? {} : { password })
      },
      claims: {}
    }),
    ...(options.createClient === undefined ? {} : { createClient: options.createClient }),
    ...(email === undefined ? {} : { email }),
    ...(password === undefined ? {} : { password })
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${PACKAGE_NAME}/${PACKAGE_VERSION} listening on stdio\n`);
}
