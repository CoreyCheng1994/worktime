export type HolidayDayType = "statutoryHoliday" | "makeupWorkday";

interface HolidayDateRange {
  name: string;
  start: string;
  end: string;
  firstDayLabel?: string;
}

interface MakeupWorkday {
  date: string;
  name: string;
}

interface HolidayScheduleYear {
  holidays: HolidayDateRange[];
  makeupWorkdays: MakeupWorkday[];
}

export interface HolidayCalendarRuleDay {
  date: string;
  type: HolidayDayType;
  label: string;
  name: string;
  sourceYear: number;
}

const HOLIDAY_SCHEDULE: Record<number, HolidayScheduleYear> = {
  2025: {
    holidays: [
      { name: "元旦", start: "2025-01-01", end: "2025-01-01" },
      { name: "春节", start: "2025-01-28", end: "2025-02-04" },
      { name: "清明节", start: "2025-04-04", end: "2025-04-06", firstDayLabel: "清明" },
      { name: "劳动节", start: "2025-05-01", end: "2025-05-05", firstDayLabel: "劳动" },
      { name: "端午节", start: "2025-05-31", end: "2025-06-02", firstDayLabel: "端午" },
      { name: "国庆节、中秋节", start: "2025-10-01", end: "2025-10-08", firstDayLabel: "国庆" }
    ],
    makeupWorkdays: [
      { date: "2025-01-26", name: "春节前补班" },
      { date: "2025-02-08", name: "春节后补班" },
      { date: "2025-04-27", name: "劳动节前补班" },
      { date: "2025-09-28", name: "国庆节、中秋节前补班" },
      { date: "2025-10-11", name: "国庆节、中秋节后补班" }
    ]
  },
  2026: {
    holidays: [
      { name: "元旦", start: "2026-01-01", end: "2026-01-03" },
      { name: "春节", start: "2026-02-15", end: "2026-02-23" },
      { name: "清明节", start: "2026-04-04", end: "2026-04-06", firstDayLabel: "清明" },
      { name: "劳动节", start: "2026-05-01", end: "2026-05-05", firstDayLabel: "劳动" },
      { name: "端午节", start: "2026-06-19", end: "2026-06-21", firstDayLabel: "端午" },
      { name: "中秋节", start: "2026-09-25", end: "2026-09-27", firstDayLabel: "中秋" },
      { name: "国庆节", start: "2026-10-01", end: "2026-10-07", firstDayLabel: "国庆" }
    ],
    makeupWorkdays: [
      { date: "2026-01-04", name: "元旦后补班" },
      { date: "2026-02-14", name: "春节前补班" },
      { date: "2026-02-28", name: "春节后补班" },
      { date: "2026-05-09", name: "劳动节后补班" },
      { date: "2026-09-20", name: "国庆节前补班" },
      { date: "2026-10-10", name: "国庆节后补班" }
    ]
  }
};

const DATE_SEGMENT_LENGTH = 3;

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => {
  const segments = dateKey.split("-");
  if (segments.length !== DATE_SEGMENT_LENGTH) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const [year, month, day] = segments.map((segment) => Number(segment));
  return new Date(year, month - 1, day);
};

const iterateDateRange = (startKey: string, endKey: string) => {
  const values: string[] = [];
  const cursor = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  while (cursor.getTime() <= end.getTime()) {
    values.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
};

export const hasHolidayScheduleForYear = (year: number) => {
  return HOLIDAY_SCHEDULE[year] !== undefined;
};

export const buildHolidayDaysForYear = (year: number): HolidayCalendarRuleDay[] => {
  const schedule = HOLIDAY_SCHEDULE[year];
  if (!schedule) {
    return [];
  }

  const result: HolidayCalendarRuleDay[] = [];
  schedule.holidays.forEach((holidayRange) => {
    iterateDateRange(holidayRange.start, holidayRange.end).forEach((date, index) => {
      result.push({
        date,
        type: "statutoryHoliday",
        label: index === 0 ? (holidayRange.firstDayLabel ?? holidayRange.name) : "休",
        name: `${holidayRange.name}（法定节假日）`,
        sourceYear: year
      });
    });
  });
  schedule.makeupWorkdays.forEach((workday) => {
    result.push({
      date: workday.date,
      type: "makeupWorkday",
      label: "班",
      name: `${workday.name}（调休补班）`,
      sourceYear: year
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
};
