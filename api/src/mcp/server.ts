import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWorktimeMcpServer } from "./worktime-mcp";

async function main() {
  const transport = new StdioServerTransport();
  const server = createWorktimeMcpServer();
  await server.connect(transport);
  console.error("[worktime-mcp] stdio server started");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[worktime-mcp] fatal: ${message}`);
  process.exit(1);
});
