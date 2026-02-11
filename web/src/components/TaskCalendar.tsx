import { useEffect, useMemo, useState } from "react";
import "../styles/task-calendar.css";

export interface TaskCalendarDayStatus {
  total: number;
  completed: number;
  pending: number;
}

export interface TaskCalendarDayStatusItem extends TaskCalendarDayStatus {
  date: string;
}

interface TaskCalendarProps {
  value: string;
  onChange: (date: string) => void;
  statusItems: TaskCalendarDayStatusItem[];
  onMonthChange?: (month: string) => void;
}

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const buildMonthGrid = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month - 1, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export function TaskCalendar({ value, onChange, statusItems, onMonthChange }: TaskCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(() => value.slice(0, 7));

  useEffect(() => {
    setDisplayMonth(value.slice(0, 7));
  }, [value]);

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const monthCells = useMemo(() => buildMonthGrid(displayMonth), [displayMonth]);

  const titleText = useMemo(() => {
    const [yearStr, monthStr] = displayMonth.split("-");
    return `${Number(yearStr)}年${Number(monthStr)}月`;
  }, [displayMonth]);

  const moveMonth = (delta: number) => {
    const [yearStr, monthStr] = displayMonth.split("-");
    const next = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1);
    const nextMonth = toMonthKey(next);
    setDisplayMonth(nextMonth);
    onMonthChange?.(nextMonth);
  };

  return (
    <section className="task-calendar" aria-label="任务日历">
      <div className="task-calendar__header">
        <button className="task-calendar__month-btn" onClick={() => moveMonth(-1)} type="button">
          ‹
        </button>
        <div className="task-calendar__month-title">{titleText}</div>
        <button className="task-calendar__month-btn" onClick={() => moveMonth(1)} type="button">
          ›
        </button>
      </div>

      <div className="task-calendar__week-row">
        {WEEK_LABELS.map((label) => (
          <span key={label} className="task-calendar__week-label">
            {label}
          </span>
        ))}
      </div>

      <div className="task-calendar__grid">
        {monthCells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="task-calendar__empty" />;
          }

          const date = formatDate(cell);
          const isSelected = date === value;
          const isToday = date === todayStr;
          const dayStatus = statusItems.find((item) => item.date === date);
          const total = dayStatus?.total ?? 0;
          const pending = dayStatus?.pending ?? 0;
          const completed = dayStatus?.completed ?? 0;
          const denominator = total > 0 ? total : pending + completed;
          const pendingRatio = denominator > 0 ? Math.max(0, Math.min(1, pending / denominator)) : 0;
          const hasProgress = denominator > 0;
          const radius = 10;
          const circumference = 2 * Math.PI * radius;
          const pendingArc = pendingRatio * circumference;

          return (
            <button
              key={date}
              type="button"
              className={`task-calendar__day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => onChange(date)}
            >
              <span className="task-calendar__day-number">
                {hasProgress ? (
                  <svg className="task-calendar__ring" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="task-calendar__ring-base" cx="12" cy="12" r={radius} />
                    {pendingRatio > 0 ? (
                      <circle
                        className="task-calendar__ring-pending"
                        cx="12"
                        cy="12"
                        r={radius}
                        strokeDasharray={`${pendingArc} ${circumference}`}
                      />
                    ) : null}
                  </svg>
                ) : null}
                <span className="task-calendar__day-number-text">{cell.getDate()}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
