import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  BatchCreateInput,
  CreateItemInput,
  HolidayCalendarDay,
  HolidayMonthOverviewResponse,
  MonthOverviewResponse,
  NormalizedWorkList,
  NormalizeWorkInput,
  MonthlyReportResponse,
  RecordItem,
  TimeSlotInput,
  UpdateItemInput,
  WorkSlot
} from "./work.types";
import { WORK_REPOSITORY, WorkRepository } from "./work.repository";
import { isAiConfigured, loadRuntimeConfig } from "../system/runtime-config";
import { WorkEventsService } from "./work-events.service";
import { buildHolidayDaysForYear, hasHolidayScheduleForYear } from "./holiday-calendar";

const FALLBACK_DEFAULT_SLOTS: Array<Pick<WorkSlot, "start_time" | "end_time" | "sort">> = [
  { start_time: "09:30:00", end_time: "12:00:00", sort: 0 },
  { start_time: "13:30:00", end_time: "19:00:00", sort: 1 }
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const NORMALIZE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "items"],
        properties: {
          date: { type: "string", pattern: "^\\\\d{4}-\\\\d{2}-\\\\d{2}$" },
          items: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    }
  }
} as const;

@Injectable()
export class WorkService {
  private readonly logger = new Logger(WorkService.name);
  constructor(
    @Inject(WORK_REPOSITORY) private readonly repo: WorkRepository,
    private readonly workEventsService: WorkEventsService
  ) {}

  async getDay(date: string) {
    this.ensureDate(date);
    const record = await this.ensureRecord(date);
    const timeSlots = await this.getSlotsOrDefault(date);

    return {
      timeSlots,
      record
    };
  }

  async saveSlots(date: string, slots: TimeSlotInput[]) {
    this.ensureDate(date);
    if (!Array.isArray(slots)) {
      throw new BadRequestException("slots 必须是数组");
    }

    const now = this.now();
    const normalizedSlots: WorkSlot[] = slots.map((slot, index) => {
      if (!slot || typeof slot !== "object") {
        throw new BadRequestException("slot 不能为空");
      }
      const start = this.normalizeTime(slot.start_time, "start_time");
      const end = this.normalizeTime(slot.end_time, "end_time");
      if (this.timeToSeconds(start) >= this.timeToSeconds(end)) {
        throw new BadRequestException("start_time 必须早于 end_time");
      }
      const sort = this.parseOptionalInt(slot.sort, index);

      return {
        id: 0,
        work_date: date,
        start_time: start,
        end_time: end,
        sort,
        created_time: now,
        updated_time: now
      };
    });

    await this.repo.replaceSlots(date, normalizedSlots);

    return await this.repo.getSlotsByDate(date);
  }

  async createItem(date: string, input: CreateItemInput, source?: string) {
    this.ensureDate(date);
    const record = await this.ensureRecord(date);
    this.ensureCreateItemInput(input);

    const now = this.now();
    const nextSort = await this.repo.getNextItemSort(record.id);
    const sort = this.parseOptionalInt(input.sort, nextSort);

    const item: RecordItem = {
      id: 0,
      record_id: record.id,
      item_type: input.item_type,
      status: input.status,
      text_value: input.text_value ?? null,
      ref_uid: input.ref_uid ?? null,
      progress_start: input.progress_start ?? null,
      progress_end: input.progress_end ?? null,
      sort,
      created_time: now,
      updated_time: now
    };

    this.validateItem(item);

    const created = await this.repo.insertItem(record.id, item);
    await this.repo.updateRecordUpdatedTime(record.id, now);
    const items = await this.repo.getItemsByRecordId(record.id);
    record.items = this.sortItems(items);
    record.updated_time = now;
    this.workEventsService.emitTaskChanged({
      action: "create_item",
      date,
      source: this.normalizeSource(source)
    });

    return created;
  }

  async updateItem(itemId: number, input: UpdateItemInput, source?: string) {
    const id = this.parseRequiredInt(itemId, "itemId");
    const item = await this.repo.findItemById(id);
    if (!item) {
      throw new NotFoundException("记录项不存在");
    }

    const updated: RecordItem = {
      ...item,
      status: input.status ?? item.status,
      text_value: input.text_value !== undefined ? input.text_value : item.text_value,
      ref_uid: input.ref_uid !== undefined ? input.ref_uid : item.ref_uid,
      progress_start:
        input.progress_start !== undefined ? input.progress_start : item.progress_start,
      progress_end: input.progress_end !== undefined ? input.progress_end : item.progress_end,
      sort: this.parseOptionalInt(input.sort, item.sort),
      updated_time: this.now()
    };

    this.validateItem(updated);

    await this.repo.updateItem(updated);
    await this.repo.updateRecordUpdatedTime(updated.record_id, updated.updated_time);
    const record = await this.repo.findRecordById(updated.record_id);
    this.workEventsService.emitTaskChanged({
      action: "update_item",
      date: record?.work_date,
      source: this.normalizeSource(source)
    });
    return updated;
  }

  async deleteItem(itemId: number, source?: string) {
    const id = this.parseRequiredInt(itemId, "itemId");
    const item = await this.repo.findItemById(id);
    if (!item) {
      throw new NotFoundException("记录项不存在");
    }

    await this.repo.deleteItem(id);
    await this.repo.updateRecordUpdatedTime(item.record_id, this.now());
    const record = await this.repo.findRecordById(item.record_id);
    this.workEventsService.emitTaskChanged({
      action: "delete_item",
      date: record?.work_date,
      source: this.normalizeSource(source)
    });
  }

  async createItemsBatch(input: BatchCreateInput, source?: string) {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("请求体不能为空");
    }
    if (!Array.isArray(input.days) || input.days.length === 0) {
      throw new BadRequestException("days 必须为非空数组");
    }

    const summaries: Array<{ date: string; count: number }> = [];
    let total = 0;

    for (const day of input.days) {
      if (!day || typeof day !== "object") {
        throw new BadRequestException("day 不能为空");
      }
      const date = day.date;
      if (typeof date !== "string") {
        throw new BadRequestException("date 必须为字符串");
      }
      this.ensureDate(date);

      if (!Array.isArray(day.items)) {
        throw new BadRequestException("items 必须为数组");
      }

      const items = day.items.map((item) => (typeof item === "string" ? item.trim() : ""));
      if (items.some((item) => item.length === 0)) {
        throw new BadRequestException("items 不能为空");
      }

      const record = await this.ensureRecord(date);
      let nextSort = await this.repo.getNextItemSort(record.id);
      const now = this.now();
      let count = 0;

      for (const text of items) {
        const item: RecordItem = {
          id: 0,
          record_id: record.id,
          item_type: 0,
          status: 2,
          text_value: text,
          ref_uid: null,
          progress_start: null,
          progress_end: null,
          sort: nextSort,
          created_time: now,
          updated_time: now
        };

        this.validateItem(item);
        await this.repo.insertItem(record.id, item);
        nextSort += 1;
        count += 1;
      }

      if (count > 0) {
        await this.repo.updateRecordUpdatedTime(record.id, now);
      }

      summaries.push({ date, count });
      total += count;
      if (count > 0) {
        this.workEventsService.emitTaskChanged({
          action: "batch_create_items",
          date,
          source: this.normalizeSource(source)
        });
      }
    }

    return { ok: true, total, days: summaries };
  }

  async getMonthReport(month: string): Promise<MonthlyReportResponse> {
    const { yearStr, monthStr, startDate, endDate } = this.parseMonthRange(month);

    const records = await this.repo.getRecordsByDateRange(startDate, endDate);
    const recordIds = records.map((record) => record.id);
    const items = await this.repo.getItemsByRecordIds(recordIds);
    const slots = await this.repo.getSlotsByDateRange(startDate, endDate);

    const itemsByRecord = new Map<number, RecordItem[]>();
    for (const item of items) {
      const list = itemsByRecord.get(item.record_id) ?? [];
      list.push(item);
      itemsByRecord.set(item.record_id, list);
    }

    const recordByDate = new Map<string, { id: number }>();
    records.forEach((record) => {
      recordByDate.set(record.work_date, { id: record.id });
    });

    const slotsByDate = new Map<string, WorkSlot[]>();
    for (const slot of slots) {
      const list = slotsByDate.get(slot.work_date) ?? [];
      list.push(slot);
      slotsByDate.set(slot.work_date, list);
    }

    const dates = new Set<string>();
    records.forEach((record) => dates.add(record.work_date));
    slots.forEach((slot) => dates.add(slot.work_date));

    const dayList = Array.from(dates)
      .sort()
      .map((date) => {
      const record = recordByDate.get(date);
      const recordItems = record ? itemsByRecord.get(record.id) ?? [] : [];
      const textItems = recordItems
        .filter((item) => item.item_type === 0 && item.text_value)
        .map((item) => (item.text_value ?? "").trim())
        .filter((text) => text.length > 0);

      const daySlots = slotsByDate.get(date) ?? [];
      const normalizedSlots = daySlots.length > 0 ? this.sortSlots(daySlots) : this.defaultSlots(date);
      const hours = this.computeSlotsHours(normalizedSlots);

      return {
        date,
        timeSlots: normalizedSlots,
        items: textItems,
        hours
      };
    })
      .filter((day) => day.items.length > 0);

    const weeks = this.groupByWeek(dayList);
    const totalHours = weeks.reduce((sum, week) => sum + week.hours, 0);
    const text = this.buildMonthlyReportText(month, weeks, totalHours);

    return {
      month,
      totalHours: this.roundHours(totalHours),
      weeks: weeks.map((week) => ({
        ...week,
        hours: this.roundHours(week.hours),
        days: week.days.map((day) => ({
          ...day,
          hours: this.roundHours(day.hours)
        }))
      })),
      text
    };
  }

  async getMonthOverview(month: string): Promise<MonthOverviewResponse> {
    const { yearStr, monthStr, startDate, endDate } = this.parseMonthRange(month);
    const records = await this.repo.getRecordsByDateRange(startDate, endDate);
    const recordIds = records.map((record) => record.id);
    const items = await this.repo.getItemsByRecordIds(recordIds);

    const overviewByDate = new Map<string, { total: number; completed: number; pending: number }>();
    records.forEach((record) => {
      overviewByDate.set(record.work_date, { total: 0, completed: 0, pending: 0 });
    });

    const dateByRecordId = new Map<number, string>();
    records.forEach((record) => {
      dateByRecordId.set(record.id, record.work_date);
    });

    items.forEach((item) => {
      if (item.item_type !== 0) return;
      const date = dateByRecordId.get(item.record_id);
      if (!date) return;
      const overview = overviewByDate.get(date) ?? { total: 0, completed: 0, pending: 0 };
      overview.total += 1;
      if (item.status === 2) {
        overview.completed += 1;
      } else {
        overview.pending += 1;
      }
      overviewByDate.set(date, overview);
    });

    return {
      month: `${yearStr}-${monthStr}`,
      days: Array.from(overviewByDate.entries())
        .map(([date, overview]) => ({ date, ...overview }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  async getHolidayMonthOverview(month: string): Promise<HolidayMonthOverviewResponse> {
    const { yearStr, monthStr, startDate, endDate } = this.parseMonthRange(month);
    const year = Number(yearStr);
    await this.ensureHolidayYearSynced(year);
    const days = await this.repo.getHolidayDaysByDateRange(startDate, endDate);
    return {
      month: `${yearStr}-${monthStr}`,
      days: days
        .map((day) => ({
          date: day.date,
          type: day.type,
          label: day.label,
          name: day.name
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  async syncHolidayCalendarForToday() {
    const currentYear = Number(this.formatLocalDate(new Date()).slice(0, 4));
    const targetYears = [currentYear, currentYear + 1].filter(
      (year, index, list) => list.indexOf(year) === index
    );
    const syncedYears: number[] = [];

    for (const year of targetYears) {
      if (!hasHolidayScheduleForYear(year)) {
        continue;
      }
      await this.ensureHolidayYearSynced(year);
      syncedYears.push(year);
    }

    return {
      ok: true,
      years: syncedYears
    };
  }

  async normalizeWork(input: NormalizeWorkInput | string): Promise<NormalizedWorkList> {
    if (!input) {
      throw new BadRequestException("请求体不能为空");
    }
    const text = typeof input === "string" ? input : input.text;
    if (typeof text !== "string" || text.trim() === "") {
      throw new BadRequestException("text 不能为空");
    }

    const selectedDate = typeof input === "string" ? null : input.selectedDate;
    if (typeof input !== "string") {
      if (typeof selectedDate !== "string" || selectedDate.trim() === "") {
        throw new BadRequestException("selectedDate 不能为空");
      }
      if (!DATE_PATTERN.test(selectedDate)) {
        throw new BadRequestException("selectedDate 格式必须为 YYYY-MM-DD");
      }
    }

    const config = loadRuntimeConfig();
    if (!isAiConfigured(config)) {
      throw new InternalServerErrorException("AI 配置不完整，请先在设置页填写");
    }
    const apiKey = config.ai.key;
    const aiUrl = config.ai.url;
    const timezone = config.ai.timezone || "UTC";
    const model = config.ai.model || "gpt-4o-mini";
    const today = this.formatLocalDate(new Date());
    const baseDate = selectedDate ?? today;
    const defaultRangeStart = baseDate;
    const defaultRangeEnd = baseDate;

    const systemPrompt = [
      "你是一个结构化信息抽取器。",
      "任务：从用户的自然语言描述中，解析出特定时间区间内的每日工作清单。",
      "输出必须严格符合给定 JSON schema，不要输出多余文本。",
      "只允许输出文本列表，items 为字符串数组。",
      "日期格式：YYYY-MM-DD。",
      `今日日期（以时区 ${timezone} 计算）：${today}。`,
      `当前选择日期（本次默认解析单日范围）：${baseDate}。`,
      "只使用服务端默认的日期范围，不要在输出中包含范围字段。",
      "默认范围为单日（服务端提供的日期），必须覆盖范围内每一天（没有事项也要给空数组）。",
      "如果存在相对时间（如'下周三'），以提供的今天/时区为基准。",
      "保持条目原始顺序；文本中不要包含任何时间信息。",
      "如果自然语言中出现进度百分比或区间，只保留结束进度并以百分比追加到文本末尾，例如“完成 REF 1001 40%”。",
      "只有当自然语言明确包含进度时才追加百分比。"
    ].join("\\n");

    const body = {
      model,
      max_tokens:8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `\n原始输入：\n${text.trim()}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "work_list",
          strict: true,
          schema: NORMALIZE_SCHEMA
        }
      },
      stream: false
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let data: any;
    this.logger.log(
      `OpenAI normalize start: model=${model}, today=${today}, baseDate=${baseDate}, timezone=${timezone}, inputLength=${text.trim().length}`
    );
    try {
      const response = await fetch(aiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message ?? "AI 请求失败";
        this.logger.warn(
          `OpenAI normalize failed: status=${response.status}, message=${message}`
        );
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(message);
        }
        throw new InternalServerErrorException(message);
      }

      // Check if output was truncated
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        this.logger.warn("OpenAI normalize warning: output truncated due to length");
        throw new InternalServerErrorException("AI 输出过长被截断，请减少输入内容或分批处理");
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`OpenAI normalize error: ${error.message}`);
        // Check for abort/timeout error
        if (error.name === "AbortError" || error.message?.includes("aborted")) {
          throw new InternalServerErrorException("AI 请求超时，请稍后重试");
        }
      } else {
        this.logger.error("OpenAI normalize error: unknown");
      }
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException("AI 调用失败，请检查网络或 API 配置");
    } finally {
      clearTimeout(timeout);
    }

    const outputText = this.extractOutputText(data);
    if (!outputText) {
      throw new InternalServerErrorException("OpenAI 返回为空");
    }

    let parsed: NormalizedWorkList;
    try {
      parsed = JSON.parse(outputText) as NormalizedWorkList;
    } catch (error) {
      this.logger.error(`OpenAI normalize parse error: invalid JSON, outputText=${outputText.substring(0, 200)}...`);
      if (!outputText.trim().endsWith("}")) {
        throw new InternalServerErrorException("AI 返回内容不完整，请减少输入内容后重试");
      }
      throw new InternalServerErrorException("AI 返回内容无法解析");
    }

    this.logger.log(
      `OpenAI normalize success: days=${parsed.days?.length ?? 0}, totalItems=${parsed.days?.reduce((sum, day) => sum + day.items.length, 0) ?? 0}`
    );

    const days = Array.isArray(parsed.days) ? parsed.days : [];
    const matched = days.find((day) => day?.date === baseDate);
    parsed.days = [
      {
        date: baseDate,
        items: Array.isArray(matched?.items) ? matched!.items : []
      }
    ];

    return parsed;
  }

  private ensureDate(date: string) {
    if (!DATE_PATTERN.test(date)) {
      throw new BadRequestException("日期格式必须为 YYYY-MM-DD");
    }
  }

  private normalizeSource(source?: string): "api" | "mcp" {
    return source === "mcp" ? "mcp" : "api";
  }

  private async ensureRecord(date: string) {
    const existing = await this.repo.findRecordByDate(date);
    if (existing) {
      const items = await this.repo.getItemsByRecordId(existing.id);
      existing.items = this.sortItems(items);
      return existing;
    }

    const now = this.now();
    const record = await this.repo.createRecord(date, now);
    record.items = [];
    return record;
  }

  private async getSlotsOrDefault(date: string) {
    const slots = await this.repo.getSlotsByDate(date);
    if (slots.length === 0) {
      return this.resolveDefaultSlots(date);
    }

    return [...slots].sort((a, b) => a.sort - b.sort);
  }

  private defaultSlots(date: string): WorkSlot[] {
    return this.resolveDefaultSlots(date);
  }

  private resolveDefaultSlots(date: string): WorkSlot[] {
    const configured = loadRuntimeConfig().work.defaultSlots;
    const normalized = configured
      .map((slot, index) => {
        try {
          const start = this.normalizeTime(slot.start, "work.defaultSlots.start");
          const end = this.normalizeTime(slot.end, "work.defaultSlots.end");
          if (this.timeToSeconds(start) >= this.timeToSeconds(end)) {
            return null;
          }
          return {
            id: 0,
            work_date: date,
            start_time: start,
            end_time: end,
            sort: index,
            created_time: "",
            updated_time: ""
          } satisfies WorkSlot;
        } catch {
          return null;
        }
      })
      .filter((slot): slot is WorkSlot => Boolean(slot));

    if (normalized.length > 0) {
      return normalized;
    }

    return FALLBACK_DEFAULT_SLOTS.map((slot) => ({
      id: 0,
      work_date: date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      sort: slot.sort,
      created_time: "",
      updated_time: ""
    }));
  }

  private sortSlots(slots: WorkSlot[]) {
    return [...slots].sort((a, b) => a.sort - b.sort);
  }

  private computeSlotsHours(slots: WorkSlot[]) {
    return slots.reduce((sum, slot) => {
      const startSeconds = this.timeToSeconds(slot.start_time);
      const endSeconds = this.timeToSeconds(slot.end_time);
      if (endSeconds <= startSeconds) {
        return sum;
      }
      return sum + (endSeconds - startSeconds) / 3600;
    }, 0);
  }

  private roundHours(value: number) {
    return Math.round(value * 100) / 100;
  }

  private groupByWeek(days: Array<{ date: string; timeSlots: WorkSlot[]; items: string[]; hours: number }>) {
    const groups = new Map<string, typeof days>();
    for (const day of days) {
      const weekStart = this.getWeekStart(day.date);
      const list = groups.get(weekStart) ?? [];
      list.push(day);
      groups.set(weekStart, list);
    }

    const weekKeys = Array.from(groups.keys()).sort();
    return weekKeys.map((key) => {
      const list = (groups.get(key) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      const startDate = list[0]?.date ?? key;
      const endDate = list[list.length - 1]?.date ?? key;
      const hours = list.reduce((sum, day) => sum + day.hours, 0);
      return { startDate, endDate, hours, days: list };
    });
  }

  private buildMonthlyReportText(month: string, weeks: Array<{ startDate: string; endDate: string; hours: number; days: Array<{ date: string; timeSlots: WorkSlot[]; items: string[]; hours: number }> }>, totalHours: number) {
    const [yearStr, monthStr] = month.split("-");
    const title = `总共${this.formatHours(totalHours, { unit: "h", space: false })}`;
    const lines: string[] = [title, ""];

    weeks.forEach((week, index) => {
      const startText = this.formatMonthDayShort(week.startDate);
      const endText = this.formatMonthDayShort(week.endDate);
      const weekRange = startText === endText ? `**${startText}**` : `**${startText} ~ ${endText}**`;
      lines.push(`${weekRange}   ${this.formatHours(week.hours, { unit: "h" })}`);
      lines.push("");
      week.days.forEach((day) => {
        const dateText = this.formatMonthDayShort(day.date);
        const weekday = this.formatWeekday(day.date);
        const timeRanges =
          day.timeSlots.length > 0
            ? day.timeSlots.map((slot) => this.formatSlotRange(slot)).join(" ")
            : "无";
        lines.push(
          `${dateText} ${weekday} ${timeRanges} **${this.formatHours(day.hours, { unit: "h" })}**`
        );
        if (day.items.length === 0) {
          lines.push("（无）");
        } else {
          day.items.forEach((item) => lines.push(item));
        }
        lines.push("");
      });
      if (index < weeks.length - 1) {
        lines.push("", "", "");
      }
    });

    return lines.join("\n");
  }

  private formatSlotRange(slot: WorkSlot) {
    return `${slot.start_time.slice(0, 5)} ~ ${slot.end_time.slice(0, 5)}`;
  }

  private formatMonthDay(date: string) {
    return date.slice(5);
  }

  private formatMonthDayShort(date: string) {
    const [_, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  private formatHours(value: number, options?: { unit?: "小时" | "h"; space?: boolean }) {
    const rounded = this.roundHours(value);
    const display = Number.isInteger(rounded)
      ? String(rounded)
      : rounded
          .toFixed(2)
          .replace(/\\.00$/, "")
          .replace(/(\\.\\d)0$/, "$1");
    const unit = options?.unit ?? "小时";
    const space = options?.space ?? true;
    return `${display}${space ? "" : ""}${unit}`;
  }

  private formatWeekday(date: string) {
    const dayIndex = new Date(`${date}T00:00:00`).getDay();
    const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return labels[dayIndex] ?? "";
  }

  private parseMonthRange(month: string) {
    if (!MONTH_PATTERN.test(month)) {
      throw new BadRequestException("月份格式必须为 YYYY-MM");
    }
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr);
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
      throw new BadRequestException("月份格式必须为 YYYY-MM");
    }

    const startDate = `${yearStr}-${monthStr}-01`;
    const endDate = this.getMonthEndDate(year, monthIndex);
    return { yearStr, monthStr, startDate, endDate };
  }

  private async ensureHolidayYearSynced(year: number) {
    if (!hasHolidayScheduleForYear(year)) {
      return;
    }
    const dayCount = await this.repo.countHolidayDaysByYear(year);
    if (dayCount > 0) {
      return;
    }
    await this.syncHolidayYear(year);
  }

  private async syncHolidayYear(year: number) {
    const holidayDays = buildHolidayDaysForYear(year);
    if (holidayDays.length === 0) {
      return;
    }
    const now = this.now();
    const rows: HolidayCalendarDay[] = holidayDays.map((day) => ({
      date: day.date,
      type: day.type,
      label: day.label,
      name: day.name,
      source_year: day.sourceYear,
      created_time: now,
      updated_time: now
    }));
    await this.repo.replaceHolidayDaysByYear(year, rows);
  }

  private getMonthEndDate(year: number, month: number) {
    const end = new Date(year, month, 0);
    return this.formatLocalDate(end);
  }

  private getWeekStart(dateStr: string) {
    const date = new Date(`${dateStr}T00:00:00`);
    const day = date.getDay();
    const offset = (day + 6) % 7;
    date.setDate(date.getDate() - offset);
    return this.formatLocalDate(date);
  }

  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private ensureCreateItemInput(input: CreateItemInput) {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("请求体不能为空");
    }

    input.item_type = this.parseRequiredInt(input.item_type, "item_type") as 0 | 1;
    input.status = this.parseRequiredInt(input.status, "status") as 0 | 1 | 2;
    if (input.item_type !== 0 && input.item_type !== 1) {
      throw new BadRequestException("item_type 必须为 0 或 1");
    }
  }

  private validateItem(item: RecordItem) {
    if (item.item_type === 0) {
      if (item.status !== 0 && item.status !== 2) {
        throw new BadRequestException("TEXT 状态只能为 0 或 2");
      }
      if (!item.text_value || typeof item.text_value !== "string" || item.text_value.trim() === "") {
        throw new BadRequestException("TEXT text_value 必须有值");
      }
      if (item.ref_uid !== null || item.progress_start !== null || item.progress_end !== null) {
        throw new BadRequestException("TEXT 不允许 ref 字段");
      }
      return;
    }

    if (item.item_type === 1) {
      if (![0, 1, 2].includes(item.status)) {
        throw new BadRequestException("REF 状态只能为 0/1/2");
      }
      if (item.ref_uid === null || !Number.isInteger(item.ref_uid)) {
        throw new BadRequestException("REF ref_uid 必须有值");
      }
      if (item.text_value !== null) {
        throw new BadRequestException("REF 不允许 text_value");
      }
      const start = this.parseRequiredInt(item.progress_start, "progress_start");
      const end = this.parseRequiredInt(item.progress_end, "progress_end");
      if (start < 0 || start > 99) {
        throw new BadRequestException("progress_start 必须在 0-99");
      }
      if (end < 1 || end > 100) {
        throw new BadRequestException("progress_end 必须在 1-100");
      }
      if (start >= end) {
        throw new BadRequestException("progress_start 必须小于 progress_end");
      }
      return;
    }

    throw new BadRequestException("item_type 无效");
  }

  private sortItems(items: RecordItem[]) {
    return [...items].sort((a, b) => a.sort - b.sort);
  }

  private parseRequiredInt(value: unknown, field: string) {
    if (value === null || value === undefined || value === "") {
      throw new BadRequestException(`${field} 必须有值`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`${field} 必须为整数`);
    }
    return parsed;
  }

  private parseOptionalInt(value: unknown, fallback: number) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException("sort 必须为整数");
    }
    return parsed;
  }

  private normalizeTime(value: string, field: string) {
    if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
      throw new BadRequestException(`${field} 格式必须为 HH:mm 或 HH:mm:ss`);
    }
    const [hour, minute, second = "00"] = value.split(":");
    const h = Number(hour);
    const m = Number(minute);
    const s = Number(second);
    if (![h, m, s].every((part) => Number.isInteger(part))) {
      throw new BadRequestException(`${field} 必须为合法时间`);
    }
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
      throw new BadRequestException(`${field} 必须为合法时间`);
    }
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  }

  private timeToSeconds(value: string) {
    const [hour, minute, second] = value.split(":").map((part) => Number(part));
    return hour * 3600 + minute * 60 + second;
  }

  private now() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  private extractOutputText(payload: any) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    // Chat Completions API format
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }
    // Legacy Responses API format (fallback)
    if (typeof payload.output_text === "string") {
      return payload.output_text;
    }
    const output = Array.isArray(payload.output) ? payload.output : [];
    const parts: string[] = [];
    for (const item of output) {
      const itemContent = Array.isArray(item?.content) ? item.content : [];
      for (const piece of itemContent) {
        if (piece?.type === "output_text" && typeof piece.text === "string") {
          parts.push(piece.text);
        }
        if (piece?.type === "refusal" && typeof piece.refusal === "string") {
          throw new BadRequestException(`模型拒绝: ${piece.refusal}`);
        }
      }
    }
    return parts.join("");
  }
}
