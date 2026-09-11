export function cliMode(argv: readonly string[]): "stdio" | "http" {
  return argv[0] === "http" || argv.includes("--http") ? "http" : "stdio";
}

export function wantsHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export function tokenOnArgv(argv: readonly string[]): boolean {
  return argv.some((arg) => arg.startsWith("--token") || arg === "-t" || arg.startsWith("--password"));
}

export const HELP = `mcpenbwmobility

  mcpenbwmobility         stdio
  mcpenbwmobility http    Streamable HTTP at /mcp

Stdio:
  ENBW_EMAIL
  ENBW_PASSWORD

HTTP OAuth consent collects myEnergyKey email + password (secrets stay on this host).
  MCP_AUTH_PASSWORD           optional operator gate
  MCP_OAUTH_SECRET            signing key
  MCPENBWMOBILITY_PUBLIC_URL  public origin behind a tunnel

Do not pass passwords on the command line.
`;
