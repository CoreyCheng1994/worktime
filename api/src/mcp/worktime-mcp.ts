import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { isAiConfigured, loadRuntimeConfig } from "../system/runtime-config";

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

const NORMALIZE_DAYS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$"
          },
          items: {
            type: "array",
            items: {
              type: "string"
            }
          }
        },
        required: ["date", "items"]
      }
    }
  },
  required: ["days"]
} as const;

const normalizedDaysZod = z.object({
  days: z.array(
    z.object({
      date: z.string().regex(DATE_PATTERN),
      items: z.array(z.string())
    })
  )
});

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function ensureDate(value: string, fieldName: string): void {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} 格式必须为 YYYY-MM-DD`);
  }
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

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const asRecord = payload as Record<string, unknown>;
  const choices = asRecord.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = first.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content === "string") {
      return content;
    }
  }

  const outputText = asRecord.output_text;
  if (typeof outputText === "string") {
    return outputText;
  }

  const output = asRecord.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const parts: string[] = [];
  for (const item of output) {
    const obj = item as Record<string, unknown>;
    const content = obj.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const piece of content) {
      const pieceObj = piece as Record<string, unknown>;
      if (pieceObj.type === "output_text" && typeof pieceObj.text === "string") {
        parts.push(pieceObj.text);
      }
      if (pieceObj.type === "refusal" && typeof pieceObj.refusal === "string") {
        throw new Error(`模型拒绝: ${pieceObj.refusal}`);
      }
    }
  }
  return parts.join("");
}

function normalizeDaysPayload(input: NormalizedDays, fallbackDate: string): NormalizedDays {
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

  if (bucket.size === 0) {
    return {
      days: [{ date: fallbackDate, items: [] }]
    };
  }

  const days = Array.from(bucket.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { days };
}

async function parseNaturalLanguageToDays(text: string, selectedDate: string): Promise<NormalizedDays> {
  const config = loadRuntimeConfig();
  if (!isAiConfigured(config)) {
    throw new Error("AI 配置不完整，请先在设置页填写");
  }
  const apiKey = config.ai.key;
  const aiUrl = config.ai.url;
  const model = config.ai.model || "gpt-4o-mini";
  const timezone = config.ai.timezone || "UTC";
  const today = formatLocalDate(new Date());

  const systemPrompt = [
    "你是一个结构化信息抽取器。",
    "请把用户描述解析为每日任务清单。",
    "输出必须严格符合 JSON schema，不要输出额外文本。",
    "字段说明：days[].date 为 YYYY-MM-DD，days[].items 为任务文本数组。",
    `今天日期（时区 ${timezone}）：${today}。`,
    `默认参考日期：${selectedDate}。`,
    "如果用户明确提到日期区间（如“下周一到周三”），需要展开到每一天。",
    "如果用户只描述时间段但没有明确日期，则使用默认参考日期。",
    "items 中保留任务文本，可包含时间描述；空任务不要输出。"
  ].join("\n");

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text.trim() }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "worktime_days",
        strict: true,
        schema: NORMALIZE_DAYS_SCHEMA
      }
    },
    stream: false
  };

  const response = await fetch(aiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } })?.error?.message || `HTTP ${response.status}`;
    throw new Error(`AI 请求失败: ${message}`);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("AI 返回为空");
  }

  const parsedRaw = JSON.parse(outputText) as unknown;
  const parsed = normalizedDaysZod.parse(parsedRaw);
  return normalizeDaysPayload(parsed, selectedDate);
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
    "batch_add_tasks_from_natural_language",
    {
      description: "把自然语言解析为按日期分组的任务，并批量写入 Worktime",
      inputSchema: {
        text: z.string().min(1).describe("自然语言任务描述"),
        selectedDate: z.string().regex(DATE_PATTERN).optional().describe("默认参考日期 YYYY-MM-DD（缺省为今天）"),
        dryRun: z.boolean().optional().describe("true 时只解析不写入数据库")
      }
    },
    async ({ text, selectedDate, dryRun }) => {
      const fallbackDate = selectedDate ?? formatLocalDate(new Date());
      ensureDate(fallbackDate, "selectedDate");

      const normalized = await parseNaturalLanguageToDays(text, fallbackDate);
      const totalItems = normalized.days.reduce((sum, day) => sum + day.items.length, 0);
      if (totalItems === 0) {
        return {
          content: [
            {
              type: "text",
              text: "解析完成，但没有可写入的任务。"
            }
          ],
          structuredContent: {
            ok: true,
            dryRun: true,
            parsed: normalized,
            writeResult: null
          }
        };
      }

      let writeResult: BatchCreateResponse | null = null;
      if (!dryRun) {
        writeResult = await requestJson<BatchCreateResponse>(apiBaseUrl, "/work/batch-items", {
          method: "POST",
          body: JSON.stringify(normalized)
        });
      }

      const structuredContent = {
        ok: true,
        dryRun: Boolean(dryRun),
        parsed: normalized,
        writeResult
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

  return server;
}
