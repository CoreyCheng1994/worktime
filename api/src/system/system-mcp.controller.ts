import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { loadRuntimeConfig } from "./runtime-config";
import { McpClientId, SystemMcpService } from "./system-mcp.service";

interface McpToggleBody {
  clients?: McpClientId[];
}

const ALLOWED_CLIENTS: McpClientId[] = ["codex", "claude", "gemini", "kimi"];

function validateClients(body: McpToggleBody): McpClientId[] | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const raw = body.clients;
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new BadRequestException("clients 必须是数组");
  }

  const normalized = raw.map((item) => String(item)) as McpClientId[];
  for (const client of normalized) {
    if (!ALLOWED_CLIENTS.includes(client)) {
      throw new BadRequestException(`不支持的客户端：${client}`);
    }
  }

  return Array.from(new Set(normalized));
}

@Controller("system/mcp")
export class SystemMcpController {
  constructor(private readonly systemMcpService: SystemMcpService) {}

  @Get("clients")
  getClients() {
    return {
      serverRouteEnabled: Boolean(loadRuntimeConfig().mcp.enabled),
      clients: this.systemMcpService.getClientStatuses()
    };
  }

  @Post("clients/enable")
  enableClients(@Body() body: McpToggleBody) {
    const clients = validateClients(body);
    return {
      clients: this.systemMcpService.setClientsEnabled(true, clients)
    };
  }

  @Post("clients/disable")
  disableClients(@Body() body: McpToggleBody) {
    const clients = validateClients(body);
    return {
      clients: this.systemMcpService.setClientsEnabled(false, clients)
    };
  }
}
