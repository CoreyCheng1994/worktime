export type ItemType = 0 | 1;
export type ItemStatus = 0 | 1 | 2;

export interface WorkSlot {
  id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  sort: number;
  created_time: string;
  updated_time: string;
}

export interface RecordItem {
  id: number;
  record_id: number;
  item_type: ItemType;
  status: ItemStatus;
  text_value: string | null;
  ref_uid: number | null;
  progress_start: number | null;
  progress_end: number | null;
  sort: number;
  created_time: string;
  updated_time: string;
}

export interface DailyRecord {
  id: number;
  work_date: string;
  created_time: string;
  updated_time: string;
  items: RecordItem[];
}

export interface CreateItemInput {
  item_type: ItemType;
  status: ItemStatus;
  text_value?: string | null;
  ref_uid?: number | null;
  progress_start?: number | null;
  progress_end?: number | null;
  sort?: number;
}

export interface UpdateItemInput {
  status?: ItemStatus;
  text_value?: string | null;
  ref_uid?: number | null;
  progress_start?: number | null;
  progress_end?: number | null;
  sort?: number;
}

export interface TimeSlotInput {
  start_time: string;
  end_time: string;
  sort?: number;
}

export interface NormalizeWorkInput {
  text: string;
}

export interface BatchCreateInput {
  days: BatchCreateDay[];
}

export interface BatchCreateDay {
  date: string;
  items: string[];
}

export interface NormalizedWorkList {
  days: NormalizedWorkDay[];
}

export interface NormalizedWorkDay {
  date: string;
  items: string[];
}

export interface MonthlyReportDay {
  date: string;
  timeSlots: WorkSlot[];
  items: string[];
  hours: number;
}

export interface WeeklyReportBlock {
  startDate: string;
  endDate: string;
  hours: number;
  days: MonthlyReportDay[];
}

export interface MonthlyReportResponse {
  month: string;
  totalHours: number;
  weeks: WeeklyReportBlock[];
  text: string;
}
