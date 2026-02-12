import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

interface MonthOverviewResponse {
  month: string;
  days: Array<{
    date: string;
    total: number;
    completed: number;
    pending: number;
  }>;
}

interface MonthlyReportResponse {
  month: string;
  totalHours: number;
  weeks: Array<{
    startDate: string;
    endDate: string;
    hours: number;
    days: Array<{
      date: string;
      hours: number;
      items: string[];
      timeSlots: Array<{ start_time: string; end_time: string }>;
    }>;
  }>;
  text: string;
}

interface BatchCreateResponse {
  ok: boolean;
  total: number;
  days: Array<{ date: string; count: number }>;
}

interface NormalizedDays {
  days: Array<{ date: string; items: string[] }>;
}

const normalizedDaysZod = z.object({
  days: z.array(
    z.object({
      date: z.string().regex(DATE_PATTERN),
      items: z.array(z.string())
    })
  )
});

function formatCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function ensureMonth(value: string, fieldName: string): void {
  if (!MONTH_PATTERN.test(value)) {
    throw new Error(`${fieldName} 格式必须为 YYYY-MM`);
  }
}

function resolveApiBaseUrl(override?: string): string {
  if (override && override.trim()) {
    return override.replace(/\/+$/, "");
  }

  const explicit = process.env.WORKTIME_API_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const port = process.env.API_PORT || "13119";
  return `http://127.0.0.1:${port}/api`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (Array.isArray(payload?.message)) {
      return payload.message.join("; ");
    }
    if (payload?.message) {
      return String(payload.message);
    }
  } catch {
    // ignore parse error
  }
  return `HTTP ${response.status}`;
}

async function requestJson<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`请求失败: ${message}`);
  }

  return (await response.json()) as T;
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!match) {
    return trimmed;
  }
  return match[1].trim();
}

function normalizeDaysPayload(input: NormalizedDays): NormalizedDays {
  const bucket = new Map<string, string[]>();

  for (const day of input.days) {
    if (!DATE_PATTERN.test(day.date)) {
      continue;
    }

    const items = day.items
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (items.length === 0) {
      continue;
    }

    const existing = bucket.get(day.date) ?? [];
    existing.push(...items);
    bucket.set(day.date, existing);
  }

  const days = Array.from(bucket.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { days };
}

function countItems(input: NormalizedDays): number {
  return input.days.reduce((sum, day) => sum + day.items.length, 0);
}

function parsePreparedDaysFromText(text: string): NormalizedDays {
  const raw = stripJsonCodeFence(text);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "batch_add_tasks_from_natural_language 已切换为 agent 侧解析模式：请先把自然语言整理为标准 JSON（{\"days\":[{\"date\":\"YYYY-MM-DD\",\"items\":[\"任务\"]}]})，再调用 batch_add_tasks。"
    );
  }

  return normalizedDaysZod.parse(parsed);
}

async function writeBatchTasks(
  apiBaseUrl: string,
  normalized: NormalizedDays,
  dryRun?: boolean
): Promise<{ ok: boolean; dryRun: boolean; parsed: NormalizedDays; writeResult: BatchCreateResponse | null }> {
  const totalItems = countItems(normalized);
  if (totalItems === 0) {
    return {
      ok: true,
      dryRun: true,
      parsed: normalized,
      writeResult: null
    };
  }

  let writeResult: BatchCreateResponse | null = null;
  if (!dryRun) {
    writeResult = await requestJson<BatchCreateResponse>(apiBaseUrl, "/work/batch-items", {
      method: "POST",
      body: JSON.stringify(normalized)
    });
  }

  return {
    ok: true,
    dryRun: Boolean(dryRun),
    parsed: normalized,
    writeResult
  };
}

export function createWorktimeMcpServer(options?: { apiBaseUrl?: string }): McpServer {
  const apiBaseUrl = resolveApiBaseUrl(options?.apiBaseUrl);

  const server = new McpServer({
    name: "worktime-mcp-server",
    version: "1.0.0"
  });

  server.registerTool(
    "get_current_month_work_summary",
    {
      description: "获取某个月（默认本月）的工作记录、工时、完成数量与完成率",
      inputSchema: {
        month: z.string().regex(MONTH_PATTERN).optional().describe("目标月份，格式 YYYY-MM；默认本月")
      }
    },
    async ({ month }) => {
      const targetMonth = month ?? formatCurrentMonth();
      ensureMonth(targetMonth, "month");

      const [overview, report] = await Promise.all([
        requestJson<MonthOverviewResponse>(apiBaseUrl, `/work/month-overview?month=${targetMonth}`),
        requestJson<MonthlyReportResponse>(apiBaseUrl, `/work/month?month=${targetMonth}`)
      ]);

      const summary = overview.days.reduce(
        (acc, day) => {
          acc.total += day.total;
          acc.completed += day.completed;
          acc.pending += day.pending;
          return acc;
        },
        { total: 0, completed: 0, pending: 0 }
      );

      const completionRate = summary.total > 0 ? Number(((summary.completed / summary.total) * 100).toFixed(2)) : 0;
      const structuredContent = {
        month: targetMonth,
        apiBaseUrl,
        totalHours: report.totalHours,
        totalTasks: summary.total,
        completedTasks: summary.completed,
        pendingTasks: summary.pending,
        completionRate,
        days: overview.days,
        weeks: report.weeks,
        reportText: report.text
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredContent, null, 2)
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "batch_add_tasks",
    {
      description: "使用标准化任务数据批量写入 Worktime（建议先由 agent 解析自然语言）",
      inputSchema: {
        days: z
          .array(
            z.object({
              date: z.string().regex(DATE_PATTERN),
              items: z.array(z.string())
            })
          )
          .min(1)
          .describe("标准任务数组，格式：[{ date: YYYY-MM-DD, items: [任务文本] }]"),
        dryRun: z.boolean().optional().describe("true 时仅校验与归一化，不写入数据库")
      }
    },
    async ({ days, dryRun }) => {
      const normalized = normalizeDaysPayload({ days });
      const structuredContent = await writeBatchTasks(apiBaseUrl, normalized, dryRun);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredContent, null, 2)
          }
        ],
        structuredContent
      };
    }
  );

  return server;
}
