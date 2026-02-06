import { DailyRecord, RecordItem, WorkSlot } from "./work.types";

export const WORK_REPOSITORY = Symbol("WORK_REPOSITORY");

export interface WorkRepository {
  getSlotsByDate(date: string): Promise<WorkSlot[]>;
  replaceSlots(date: string, slots: WorkSlot[]): Promise<void>;
  getSlotsByDateRange(startDate: string, endDate: string): Promise<WorkSlot[]>;

  findRecordByDate(date: string): Promise<DailyRecord | null>;
  createRecord(date: string, now: string): Promise<DailyRecord>;
  updateRecordUpdatedTime(recordId: number, updatedTime: string): Promise<void>;
  getRecordsByDateRange(startDate: string, endDate: string): Promise<DailyRecord[]>;

  getItemsByRecordId(recordId: number): Promise<RecordItem[]>;
  getItemsByRecordIds(recordIds: number[]): Promise<RecordItem[]>;
  getNextItemSort(recordId: number): Promise<number>;
  insertItem(recordId: number, item: RecordItem): Promise<RecordItem>;
  findItemById(itemId: number): Promise<RecordItem | null>;
  updateItem(item: RecordItem): Promise<void>;
  deleteItem(itemId: number): Promise<void>;
}
