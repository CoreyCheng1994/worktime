import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RuntimeDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface RuntimeAiConfig {
  url: string;
  key: string;
  model: string;
  timezone: string;
}

export interface RuntimeMcpConfig {
  enabled: boolean;
}

export interface RuntimeWorkSlotConfig {
  start: string;
  end: string;
}

export interface RuntimeWorkConfig {
  defaultSlots: RuntimeWorkSlotConfig[];
}

export interface RuntimeConfig {
  db: RuntimeDbConfig;
  ai: RuntimeAiConfig;
  mcp: RuntimeMcpConfig;
  work: RuntimeWorkConfig;
  updatedAt: string;
}

export interface RuntimeConfigPatch {
  db?: Partial<RuntimeDbConfig>;
  ai?: Partial<RuntimeAiConfig>;
  mcp?: Partial<RuntimeMcpConfig>;
  work?: Partial<RuntimeWorkConfig>;
}

export function getWorktimeHomeDir(): string {
  return join(homedir(), ".worktime");
}

export function getRuntimeConfigPath(): string {
  return join(getWorktimeHomeDir(), "config.json");
}

function defaultRuntimeConfig(): RuntimeConfig {
  return {
    db: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      name: process.env.DB_NAME || "worktime"
    },
    ai: {
      url: process.env.AI_URL || "",
      key: process.env.AI_KEY || "",
      model: process.env.AI_MODEL || "gpt-4o-mini",
      timezone: process.env.TZ || "UTC"
    },
    mcp: {
      enabled: true
    },
    work: {
      defaultSlots: [
        { start: "09:30", end: "12:00" },
        { start: "13:30", end: "19:00" }
      ]
    },
    updatedAt: new Date().toISOString()
  };
}

function normalizeConfig(input: Partial<RuntimeConfig> | null | undefined): RuntimeConfig {
  const fallback = defaultRuntimeConfig();
  return {
    db: {
      host: input?.db?.host ?? fallback.db.host,
      port: Number(input?.db?.port ?? fallback.db.port),
      user: input?.db?.user ?? fallback.db.user,
      password: input?.db?.password ?? fallback.db.password,
      name: input?.db?.name ?? fallback.db.name
    },
    ai: {
      url: input?.ai?.url ?? fallback.ai.url,
      key: input?.ai?.key ?? fallback.ai.key,
      model: input?.ai?.model ?? fallback.ai.model,
      timezone: input?.ai?.timezone ?? fallback.ai.timezone
    },
    mcp: {
      enabled: Boolean(input?.mcp?.enabled ?? fallback.mcp.enabled)
    },
    work: {
      defaultSlots:
        input?.work?.defaultSlots && Array.isArray(input.work.defaultSlots) && input.work.defaultSlots.length > 0
          ? input.work.defaultSlots.map((slot) => ({
              start: String(slot?.start ?? "").trim(),
              end: String(slot?.end ?? "").trim()
            }))
          : fallback.work.defaultSlots
    },
    updatedAt: input?.updatedAt ?? fallback.updatedAt
  };
}

export function ensureRuntimeConfigFile(): RuntimeConfig {
  const dir = getWorktimeHomeDir();
  const path = getRuntimeConfigPath();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(path)) {
    const cfg = defaultRuntimeConfig();
    writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
    return cfg;
  }

  return loadRuntimeConfig();
}

export function loadRuntimeConfig(): RuntimeConfig {
  const path = getRuntimeConfigPath();
  if (!existsSync(path)) {
    return ensureRuntimeConfigFile();
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RuntimeConfig>;
    return normalizeConfig(parsed);
  } catch {
    const cfg = defaultRuntimeConfig();
    writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
    return cfg;
  }
}

export function saveRuntimeConfig(input: RuntimeConfig): RuntimeConfig {
  const path = getRuntimeConfigPath();
  const dir = getWorktimeHomeDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const next: RuntimeConfig = {
    ...normalizeConfig(input),
    updatedAt: new Date().toISOString()
  };

  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
}

export function patchRuntimeConfig(patch: RuntimeConfigPatch): RuntimeConfig {
  const current = loadRuntimeConfig();
  const next: RuntimeConfig = {
    db: {
      ...current.db,
      ...(patch.db ?? {})
    },
    ai: {
      ...current.ai,
      ...(patch.ai ?? {})
    },
    mcp: {
      ...current.mcp,
      ...(patch.mcp ?? {})
    },
    work: {
      ...current.work,
      ...(patch.work ?? {})
    },
    updatedAt: new Date().toISOString()
  };

  return saveRuntimeConfig(next);
}

export function isDbConfigured(config: RuntimeConfig): boolean {
  return Boolean(
    config.db.host.trim() &&
      Number.isFinite(config.db.port) &&
      config.db.port > 0 &&
      config.db.user.trim() &&
      config.db.password.trim() &&
      config.db.name.trim()
  );
}

export function isAiConfigured(config: RuntimeConfig): boolean {
  return Boolean(config.ai.url.trim() && config.ai.key.trim());
}
