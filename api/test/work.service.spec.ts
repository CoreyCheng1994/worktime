import { WorkService } from "../src/work/work.service";
import { WorkRepository } from "../src/work/work.repository";
import { DailyRecord, RecordItem, WorkSlot } from "../src/work/work.types";

describe("WorkService", () => {
  let service: WorkService;

  beforeEach(() => {
    service = new WorkService(new InMemoryWorkRepository());
  });

  it("returns default slots when none are saved", async () => {
    const data = await service.getDay("2026-02-02");
    expect(data.timeSlots).toHaveLength(2);
    expect(data.timeSlots[0].start_time).toBe("09:30:00");
    expect(data.timeSlots[1].end_time).toBe("19:00:00");
  });

  it("validates and saves slots", async () => {
    const slots = await service.saveSlots("2026-02-02", [
      { start_time: "08:00", end_time: "10:00", sort: 1 },
      { start_time: "10:30", end_time: "12:00" }
    ]);
    expect(slots).toHaveLength(2);
    expect(slots[0].start_time).toBe("08:00:00");
    expect(slots[1].start_time).toBe("10:30:00");
  });

  it("rejects invalid slot time range", async () => {
    await expect(
      service.saveSlots("2026-02-02", [{ start_time: "12:00", end_time: "11:00" }])
    ).rejects.toThrow("start_time 必须早于 end_time");
  });

  it("creates TEXT and REF items with validation", async () => {
    const textItem = await service.createItem("2026-02-02", {
      item_type: 0,
      status: 0,
      text_value: "整理日报"
    });
    expect(textItem.item_type).toBe(0);

    const refItem = await service.createItem("2026-02-02", {
      item_type: 1,
      status: 1,
      ref_uid: 123,
      progress_start: 10,
      progress_end: 60
    });
    expect(refItem.item_type).toBe(1);
  });

  it("rejects invalid TEXT status", async () => {
    await expect(
      service.createItem("2026-02-02", {
        item_type: 0,
        status: 1,
        text_value: "不允许部分完成"
      })
    ).rejects.toThrow("TEXT 状态只能为 0 或 2");
  });

  it("rejects invalid REF progress", async () => {
    await expect(
      service.createItem("2026-02-02", {
        item_type: 1,
        status: 0,
        ref_uid: 123,
        progress_start: 80,
        progress_end: 20
      })
    ).rejects.toThrow("progress_start 必须小于 progress_end");
  });

  it("updates and deletes items", async () => {
    const item = await service.createItem("2026-02-02", {
      item_type: 0,
      status: 0,
      text_value: "初始"
    });

    const updated = await service.updateItem(item.id, { status: 2, text_value: "完成" });
    expect(updated.status).toBe(2);

    await service.deleteItem(item.id);
    await expect(service.updateItem(item.id, { status: 0 })).rejects.toThrow("记录项不存在");
  });

  it("normalize requires selectedDate when using object input", async () => {
    await expect(
      // @ts-expect-error intentionally missing selectedDate for validation
      service.normalizeWork({ text: "随便写点东西" })
    ).rejects.toThrow("selectedDate 不能为空");

    await expect(
      service.normalizeWork({ text: "随便写点东西", selectedDate: "2026/02/02" })
    ).rejects.toThrow("selectedDate 格式必须为 YYYY-MM-DD");
  });
});

class InMemoryWorkRepository implements WorkRepository {
  private nextRecordId = 1;
  private nextItemId = 1;
  private nextSlotId = 1;
  private recordsByDate = new Map<string, DailyRecord>();
  private itemsById = new Map<number, RecordItem>();
  private slotsByDate = new Map<string, WorkSlot[]>();

  async getSlotsByDate(date: string): Promise<WorkSlot[]> {
    return this.slotsByDate.get(date) ?? [];
  }

  async replaceSlots(date: string, slots: WorkSlot[]): Promise<void> {
    const stored = slots.map((slot) => ({ ...slot, id: this.nextSlotId++ }));
    this.slotsByDate.set(date, stored);
  }

  async getSlotsByDateRange(startDate: string, endDate: string): Promise<WorkSlot[]> {
    const result: WorkSlot[] = [];
    for (const [date, slots] of this.slotsByDate.entries()) {
      if (date >= startDate && date <= endDate) {
        result.push(...slots);
      }
    }
    return result;
  }

  async findRecordByDate(date: string): Promise<DailyRecord | null> {
    return this.recordsByDate.get(date) ?? null;
  }

  async createRecord(date: string, now: string): Promise<DailyRecord> {
    const record: DailyRecord = {
      id: this.nextRecordId++,
      work_date: date,
      created_time: now,
      updated_time: now,
      items: []
    };
    this.recordsByDate.set(date, record);
    return record;
  }

  async updateRecordUpdatedTime(recordId: number, updatedTime: string): Promise<void> {
    for (const record of this.recordsByDate.values()) {
      if (record.id === recordId) {
        record.updated_time = updatedTime;
        return;
      }
    }
  }

  async getRecordsByDateRange(startDate: string, endDate: string): Promise<DailyRecord[]> {
    const result: DailyRecord[] = [];
    for (const record of this.recordsByDate.values()) {
      if (record.work_date >= startDate && record.work_date <= endDate) {
        result.push(record);
      }
    }
    // Keep deterministic order for tests.
    result.sort((a, b) => a.work_date.localeCompare(b.work_date));
    return result;
  }

  async getItemsByRecordId(recordId: number): Promise<RecordItem[]> {
    const record = [...this.recordsByDate.values()].find((item) => item.id === recordId);
    return record ? [...record.items] : [];
  }

  async getItemsByRecordIds(recordIds: number[]): Promise<RecordItem[]> {
    const result: RecordItem[] = [];
    for (const id of recordIds) {
      result.push(...(await this.getItemsByRecordId(id)));
    }
    return result;
  }

  async getNextItemSort(recordId: number): Promise<number> {
    const items = await this.getItemsByRecordId(recordId);
    if (items.length === 0) {
      return 0;
    }
    return Math.max(...items.map((item) => item.sort)) + 1;
  }

  async insertItem(recordId: number, item: RecordItem): Promise<RecordItem> {
    const created = { ...item, id: this.nextItemId++ };
    const record = [...this.recordsByDate.values()].find((value) => value.id === recordId);
    if (record) {
      record.items.push(created);
    }
    this.itemsById.set(created.id, created);
    return created;
  }

  async findItemById(itemId: number): Promise<RecordItem | null> {
    return this.itemsById.get(itemId) ?? null;
  }

  async updateItem(item: RecordItem): Promise<void> {
    const existing = this.itemsById.get(item.id);
    if (!existing) {
      return;
    }
    Object.assign(existing, item);
    for (const record of this.recordsByDate.values()) {
      record.items = record.items.map((entry) => (entry.id === item.id ? existing : entry));
    }
  }

  async deleteItem(itemId: number): Promise<void> {
    this.itemsById.delete(itemId);
    for (const record of this.recordsByDate.values()) {
      record.items = record.items.filter((entry) => entry.id !== itemId);
    }
  }
}
