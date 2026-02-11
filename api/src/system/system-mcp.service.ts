import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { Injectable } from "@nestjs/common";

export type McpClientId = "codex" | "claude" | "gemini" | "kimi";

interface McpClientDescriptor {
  id: McpClientId;
  label: string;
  binary: string;
  kind: "toml" | "json";
  resolveCandidatePaths: () => string[];
}

export interface McpClientStatus {
  id: McpClientId;
  label: string;
  configPath: string;
  installed: boolean;
  configExists: boolean;
  enabled: boolean;
  manageable: boolean;
  error?: string;
}

interface McpServerDefinition {
  command: string;
  args: string[];
}

const WORKTIME_SERVER_NAME = "worktime";
const START_MARKER = "# >>> worktime-mcp (managed by worktime)";
const END_MARKER = "# <<< worktime-mcp (managed by worktime)";

const CLIENTS: McpClientDescriptor[] = [
  {
    id: "codex",
    label: "Codex CLI",
    binary: "codex",
    kind: "toml",
    resolveCandidatePaths: () => {
      const codexHome = process.env.CODEX_HOME?.trim();
      const xdgConfig = process.env.XDG_CONFIG_HOME?.trim();
      return [
        codexHome ? join(codexHome, "config.toml") : "",
        xdgConfig ? join(xdgConfig, "codex", "config.toml") : "",
        join(homedir(), ".codex", "config.toml")
      ];
    }
  },
  {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    kind: "json",
    resolveCandidatePaths: () => {
      const explicit = process.env.CLAUDE_CONFIG_PATH?.trim();
      const xdgConfig = process.env.XDG_CONFIG_HOME?.trim();
      return [
        explicit || "",
        join(homedir(), ".claude.json"),
        xdgConfig ? join(xdgConfig, "claude", "config.json") : "",
        join(homedir(), ".config", "claude", "config.json")
      ];
    }
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    binary: "gemini",
    kind: "json",
    resolveCandidatePaths: () => {
      const geminiHome = process.env.GEMINI_HOME?.trim();
      const xdgConfig = process.env.XDG_CONFIG_HOME?.trim();
      return [
        geminiHome ? join(geminiHome, "settings.json") : "",
        xdgConfig ? join(xdgConfig, "gemini", "settings.json") : "",
        join(homedir(), ".gemini", "settings.json")
      ];
    }
  },
  {
    id: "kimi",
    label: "Kimi CLI",
    binary: "kimi",
    kind: "json",
    resolveCandidatePaths: () => {
      const kimiHome = process.env.KIMI_HOME?.trim();
      const xdgConfig = process.env.XDG_CONFIG_HOME?.trim();
      return [
        kimiHome ? join(kimiHome, "mcp.json") : "",
        xdgConfig ? join(xdgConfig, "kimi", "mcp.json") : "",
        join(homedir(), ".kimi", "mcp.json")
      ];
    }
  }
];

function resolveRepoRoot(): string {
  return join(__dirname, "../../..");
}

function resolveWorktimeMcpServer(): McpServerDefinition {
  const command = join(resolveRepoRoot(), "scripts", "worktime");
  return {
    command,
    args: ["mcp"]
  };
}

function hasBinary(binary: string): boolean {
  const result = spawnSync("which", [binary], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function resolveConfigPath(client: McpClientDescriptor): string {
  const candidates = Array.from(
    new Set(
      client
        .resolveCandidatePaths()
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  const existing = candidates.find((path) => existsSync(path));
  return existing ?? candidates[0] ?? "";
}

function hasAnyConfigFile(client: McpClientDescriptor): boolean {
  return client.resolveCandidatePaths().some((path) => path && existsSync(path));
}

function toManagedTomlBlock(definition: McpServerDefinition): string {
  const escapedCommand = definition.command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const args = definition.args
    .map((item) => `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(", ");

  return `${START_MARKER}\n[mcp_servers.${WORKTIME_SERVER_NAME}]\ncommand = "${escapedCommand}"\nargs = [${args}]\n${END_MARKER}`;
}

function ensureJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }

  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("配置文件格式无效，必须是 JSON 对象");
  }

  return parsed as Record<string, unknown>;
}

function writeJson(path: string, data: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function readToml(path: string): string {
  if (!existsSync(path)) {
    return "";
  }

  return readFileSync(path, "utf-8");
}

function writeToml(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  writeFileSync(path, normalized, "utf-8");
}

function hasCodexWorktimeServer(content: string): boolean {
  return /\[mcp_servers\.worktime\]/.test(content);
}

function stripManagedTomlBlock(content: string): string {
  if (!content.includes(START_MARKER) || !content.includes(END_MARKER)) {
    return content;
  }

  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER, start);
  if (start < 0 || end < 0) {
    return content;
  }

  const endIndex = end + END_MARKER.length;
  const before = content.slice(0, start).replace(/[ \t]*\n?$/, "\n");
  const after = content.slice(endIndex).replace(/^\n+/, "\n");
  const merged = `${before}${after}`;
  return merged.replace(/^\s+$/m, "").trimEnd();
}

function stripWorktimeTomlSection(content: string): string {
  const regex = /\n?\[mcp_servers\.worktime\][\s\S]*?(?=\n\[[^\]]+\]|\s*$)/g;
  return content.replace(regex, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function isJsonWorktimeEnabled(value: Record<string, unknown>): boolean {
  const mcpServers = value.mcpServers;
  if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
    return false;
  }

  return Boolean((mcpServers as Record<string, unknown>)[WORKTIME_SERVER_NAME]);
}

function enableJsonWorktime(path: string, definition: McpServerDefinition): void {
  const current = ensureJsonObject(path);
  const mcpServersRaw = current.mcpServers;
  const mcpServers =
    mcpServersRaw && typeof mcpServersRaw === "object" && !Array.isArray(mcpServersRaw)
      ? (mcpServersRaw as Record<string, unknown>)
      : {};

  mcpServers[WORKTIME_SERVER_NAME] = {
    command: definition.command,
    args: definition.args
  };

  current.mcpServers = mcpServers;
  writeJson(path, current);
}

function disableJsonWorktime(path: string): void {
  const current = ensureJsonObject(path);
  const mcpServersRaw = current.mcpServers;
  if (!mcpServersRaw || typeof mcpServersRaw !== "object" || Array.isArray(mcpServersRaw)) {
    writeJson(path, current);
    return;
  }

  const mcpServers = { ...(mcpServersRaw as Record<string, unknown>) };
  delete mcpServers[WORKTIME_SERVER_NAME];
  current.mcpServers = mcpServers;
  writeJson(path, current);
}

function enableCodexToml(path: string, definition: McpServerDefinition): void {
  const current = readToml(path);
  const cleaned = stripManagedTomlBlock(current);

  if (hasCodexWorktimeServer(cleaned)) {
    const withoutSection = stripWorktimeTomlSection(cleaned);
    const block = toManagedTomlBlock(definition);
    const next = withoutSection.trim() ? `${withoutSection.trimEnd()}\n\n${block}` : block;
    writeToml(path, next);
    return;
  }

  const block = toManagedTomlBlock(definition);
  const next = cleaned.trim() ? `${cleaned.trimEnd()}\n\n${block}` : block;
  writeToml(path, next);
}

function disableCodexToml(path: string): void {
  const current = readToml(path);
  if (!current.trim()) {
    return;
  }

  const noManagedBlock = stripManagedTomlBlock(current);
  const noSection = stripWorktimeTomlSection(noManagedBlock);
  writeToml(path, noSection.trim());
}

@Injectable()
export class SystemMcpService {
  getClientStatuses(): McpClientStatus[] {
    return CLIENTS.map((client) => {
      const configPath = resolveConfigPath(client);
      const installed = hasBinary(client.binary) || hasAnyConfigFile(client);
      const configExists = Boolean(configPath) && existsSync(configPath);

      try {
        let enabled = false;
        if (client.kind === "toml") {
          enabled = hasCodexWorktimeServer(readToml(configPath));
        } else if (configExists) {
          enabled = isJsonWorktimeEnabled(ensureJsonObject(configPath));
        }

        return {
          id: client.id,
          label: client.label,
          configPath,
          installed,
          configExists,
          enabled,
          manageable: installed,
          error: !installed ? `${client.label} 未安装或未初始化` : undefined
        };
      } catch (error) {
        return {
          id: client.id,
          label: client.label,
          configPath,
          installed,
          configExists,
          enabled: false,
          manageable: installed,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  setClientsEnabled(enabled: boolean, ids?: McpClientId[]): McpClientStatus[] {
    const targetSet = ids && ids.length ? new Set(ids) : null;
    const definition = resolveWorktimeMcpServer();

    for (const client of CLIENTS) {
      if (targetSet && !targetSet.has(client.id)) {
        continue;
      }

      const configPath = resolveConfigPath(client);
      const installed = hasBinary(client.binary) || hasAnyConfigFile(client);
      if (!installed) {
        throw new Error(`${client.label} 未安装，无法${enabled ? "启用" : "关闭"} MCP`);
      }

      if (client.kind === "toml") {
        if (enabled) {
          enableCodexToml(configPath, definition);
        } else {
          disableCodexToml(configPath);
        }
        continue;
      }

      if (enabled) {
        enableJsonWorktime(configPath, definition);
      } else {
        disableJsonWorktime(configPath);
      }
    }

    return this.getClientStatuses();
  }
}
