import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InputNumber } from "../components/Input";
import { Spin } from "../components/Spin";
import { Modal, notification } from "antd";
import type { CSSProperties } from "react";
import type { TaskCalendarDayStatusItem } from "../components/TaskCalendar";
import { TaskCalendar } from "../components/TaskCalendar";

// ==================== Types ====================
interface WorkSlot {
  id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  sort: number;
  created_time: string;
  updated_time: string;
}

interface RecordItem {
  id: number;
  record_id: number;
  item_type: 0 | 1;
  status: 0 | 1 | 2;
  text_value: string | null;
  ref_uid: number | null;
  progress_start: number | null;
  progress_end: number | null;
  sort: number;
  created_time: string;
  updated_time: string;
}

interface DailyRecord {
  id: number;
  work_date: string;
  created_time: string;
  updated_time: string;
  items: RecordItem[];
}

interface WorkDayResponse {
  timeSlots: WorkSlot[];
  record: DailyRecord;
}

interface MonthOverviewResponse {
  month: string;
  days: TaskCalendarDayStatusItem[];
}

interface NormalizedWorkList {
  days: NormalizedWorkDay[];
}

interface NormalizedWorkDay {
  date: string;
  items: string[];
}

type ItemStatus = 0 | 1 | 2;

// ==================== Constants ====================
const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "待办", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  1: { label: "进行中", color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  2: { label: "已完成", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" }
};

// ==================== Utils ====================
const formatDate = (value: Date) => {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
};

const toMonthValue = (dateStr: string) => dateStr.slice(0, 7);

const resolveIsNarrow = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1200;
};

const resolveErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (Array.isArray(data?.message)) return data.message.join(";");
    if (data?.message) return String(data.message);
  } catch {
    return null;
  }
  return null;
};

const requestJson = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const message = (await resolveErrorMessage(response)) ?? `请求失败 (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as T;
};

const normalizeSlot = (slot: WorkSlot, index: number) => ({
  id: slot.id,
  start_time: slot.start_time.slice(0, 5),
  end_time: slot.end_time.slice(0, 5),
  sort: Number.isFinite(slot.sort) ? slot.sort : index
});

type EditableSlot = ReturnType<typeof normalizeSlot>;

type EditableItem = {
  id: number;
  item_type: 0;
  status: ItemStatus;
  text_value: string;
  sort: number;
  updated_time: string;
};

const buildEditableItem = (item: RecordItem): EditableItem => ({
  id: item.id,
  item_type: 0,
  status: item.status,
  text_value: item.text_value ?? "",
  sort: item.sort,
  updated_time: item.updated_time
});

const containsHttpUrl = (text: string) => /https?:\/\/\S+/i.test(text);

// ==================== Styles ====================
const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f1ea",
    fontFamily: "'Space Grotesk', 'PingFang SC', 'Noto Sans SC', sans-serif",
    color: "#1f2937"
  },
  container: {
    maxWidth: "none",
    margin: "0 auto",
    padding: "32px 16px"
  },
  // Header
  header: {
    marginBottom: "24px",
    display: "flex",
    alignItems: "flex-start",
    gap: "24px"
  },
  datePicker: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    fontSize: "14px",
    color: "#57534e",
    cursor: "pointer",
    outline: "none",
    fontFamily: "inherit"
  },
  dateDisplay: {
    display: "flex",
    alignItems: "baseline",
    gap: "12px"
  },
  dateMain: {
    fontFamily: "'Playfair Display', 'Noto Serif SC', serif",
    fontSize: "32px",
    fontWeight: 600,
    color: "#1c1917",
    letterSpacing: "-0.02em",
    lineHeight: 1
  },
  dateSub: {
    fontSize: "16px",
    color: "#78716c",
    fontWeight: 500
  },
  // Stats
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  },
  statPill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: 600,
    border: "1px solid #e5e7eb"
  },
  statMetricPill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)"
  },
  // Main Layout
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "24px",
    alignItems: "start"
  },
  // Sidebar
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "sticky",
    top: "84px"
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#a8a29e",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "12px"
  },
  // Time Slots - Simplified
  slotList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  slotItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    borderRadius: "10px",
    background: "#fff",
    border: "1px solid #f5f5f4"
  },
  slotTimeDisplay: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    color: "#44403c",
    fontWeight: 500
  },
  slotTimeEdit: {
    width: "56px",
    padding: "4px 6px",
    fontSize: "13px",
    border: "1px solid #e7e5e4",
    borderRadius: "6px",
    textAlign: "center",
    fontFamily: "inherit",
    background: "#fafaf9"
  },
  slotDeleteBtn: {
    padding: "6px",
    minWidth: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#a8a29e",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 0.15s ease"
  },
  slotEmpty: {
    textAlign: "center",
    padding: "32px 16px",
    color: "#a8a29e",
    fontSize: "13px",
    background: "#fff",
    borderRadius: "10px",
    border: "1px dashed #e7e5e4"
  },
  addSlotBtn: {
    width: "100%",
    marginTop: "8px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px dashed #d6d3d1",
    background: "transparent",
    color: "#78716c",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit"
  },
  saveSlotsBtn: {
    width: "100%",
    marginTop: "8px",
    padding: "10px",
    borderRadius: "8px",
    background: "#1c1917",
    color: "#fafaf9",
    border: "none",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  // Main Content
  mainContent: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  composerTriggerBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid transparent",
    background: "transparent",
    color: "#3b82f6",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    transition: "background-color 0.18s ease, border-color 0.18s ease"
  },
  composerTriggerIcon: {
    width: "18px",
    height: "18px"
  },
  composerModalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  // Input Area
  inputCard: {
    background: "#fbfaf7",
    borderRadius: "20px",
    padding: "16px",
    minHeight: "232px",
    border: "1px solid #e7e2d8",
    boxShadow: "0 8px 22px rgba(31, 41, 55, 0.06)",
    transition: "background-color 0.22s ease, border-color 0.22s ease"
  },
  aiCard: {
    background: "#fbfaf7",
    borderRadius: "20px",
    padding: "16px",
    minHeight: "232px",
    border: "1px solid #d5cebf",
    boxShadow: "0 8px 22px rgba(31, 41, 55, 0.08)",
    transition: "background-color 0.22s ease, border-color 0.22s ease"
  },
  aiHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "8px"
  },
  aiTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#1f2937",
    letterSpacing: "0.01em"
  },
  aiBadge: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#111827",
    color: "#f9fafb"
  },
  aiTextarea: {
    width: "100%",
    minHeight: "126px",
    padding: "14px 16px",
    borderRadius: "10px",
    border: "1px solid #e7e2d8",
    background: "#ffffff",
    fontSize: "14px",
    lineHeight: 1.6,
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none"
  },
  aiActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginTop: "12px",
    flexWrap: "wrap"
  },
  aiButton: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    background: "#3b82f6",
    color: "#f9fafb",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  aiGhostButton: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "1px solid #d5cebf",
    background: "#ffffff",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  modeSwitch: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px",
    background: "rgba(255,255,255,0.78)",
    borderRadius: "12px",
    border: "1px solid #e5e7eb"
  },
  modeSwitchBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#5b6472",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background-color 0.2s ease, color 0.2s ease"
  },
  modeSwitchBtnActive: {
    background: "#ffffff",
    color: "#1f2937",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)"
  },
  aiHint: {
    fontSize: "12px",
    color: "#5b6472"
  },
  aiPreview: {
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  aiDayCard: {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #dbe4f8",
    padding: "16px"
  },
  aiDayHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "12px"
  },
  aiDayTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#111827",
    letterSpacing: "0.02em"
  },
  aiItemRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginBottom: "8px"
  },
  aiItemInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
    fontFamily: "inherit"
  },
  aiIconButton: {
    border: "none",
    background: "#fef2f2",
    color: "#ef4444",
    borderRadius: "8px",
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600
  },
  aiAddItemButton: {
    marginTop: "8px",
    border: "1px dashed #cbd5f5",
    background: "#f8fafc",
    color: "#1f2937",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  aiFooter: {
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap"
  },
  aiCount: {
    fontSize: "12px",
    color: "#6b7280"
  },
  modeStage: {
    minHeight: "156px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    transition: "min-height 0.22s cubic-bezier(0.2, 0.7, 0.2, 1)"
  },
  inputWrapper: {
    position: "relative"
  },
  taskInput: {
    width: "100%",
    padding: "16px 100px 16px 20px",
    fontSize: "16px",
    border: "1px solid #e7e2d8",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
    background: "#ffffff",
    fontFamily: "inherit",
    color: "#1f2937"
  },
  taskInputFocus: {
    borderColor: "#60a5fa",
    boxShadow: "0 0 0 3px rgba(59,130,246,0.16)",
    background: "#fff"
  },
  inputHint: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#a8a29e"
  },
  addBtn: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    padding: "10px 20px",
    borderRadius: "10px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  // Board
  board: {
    display: "grid",
    gridTemplateColumns: "1.05fr 1fr 0.95fr",
    gap: "16px"
  },
  column: {
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "16px",
    minHeight: "520px",
    border: "1px solid #e5e7eb"
  },
  columnDone: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    minHeight: "520px"
  },
  columnDropActive: {
    boxShadow: "inset 0 0 0 2px rgba(59,130,246,0.45), 0 10px 24px rgba(59,130,246,0.10)",
    transform: "translateY(-2px)",
    transition: "box-shadow 0.18s ease, transform 0.18s ease"
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    padding: "4px"
  },
  columnHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  columnTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 600
  },
  columnTitleText: {
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "0.01em"
  },
  columnTitleCount: {
    fontSize: "14px",
    fontWeight: 600,
    opacity: 0.82
  },
  columnDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%"
  },
  columnCount: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    background: "#fff",
    padding: "4px 10px",
    borderRadius: "100px"
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "420px",
    maxHeight: "calc(100vh - 260px)",
    overflowY: "auto",
    paddingRight: "4px"
  },
  // Task Card
  taskCard: {
    background: "#fff",
    borderRadius: "10px",
    padding: "8px 10px",
    border: "none",
    boxShadow: "inset 0 0 0 1px transparent",
    transition: "box-shadow 0.2s ease",
    cursor: "grab"
  },
  taskCardHover: {
    boxShadow: "inset 0 0 0 1px #d7dde5"
  },
  taskCardDone: {
    background: "#fff",
    borderRadius: "10px",
    padding: "8px 10px",
    border: "none",
    boxShadow: "inset 0 0 0 1px transparent",
    transition: "box-shadow 0.2s ease",
    cursor: "grab"
  },
  taskCardDragging: {
    opacity: 0.45,
    transform: "scale(0.985)",
    boxShadow: "0 14px 26px rgba(15,23,42,0.18)"
  },
  taskCardDoneHover: {
    boxShadow: "inset 0 0 0 1px #d7dde5"
  },
  taskMainRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0
  },
  taskContentDone: {
    fontSize: "14px",
    lineHeight: 1.4,
    color: "#166534",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  taskContent: {
    fontSize: "14px",
    lineHeight: 1.4,
    color: "#292524",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  taskActions: {
    display: "flex",
    gap: "0",
    alignItems: "center",
    opacity: 0,
    transform: "translateY(2px)",
    transition: "opacity 0.18s ease, transform 0.18s ease"
  },
  taskActionGroup: {
    display: "flex",
    gap: "0",
    alignItems: "center"
  },
  deleteBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#9ca3af",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  },
  deleteBtnHover: {
    color: "#b91c1c",
    background: "#fef2f2"
  },
  // Edit Mode
  editInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  editInput: {
    flex: 1,
    minWidth: 0,
    padding: "4px 0",
    fontSize: "14px",
    border: "none",
    background: "transparent",
    outline: "none",
    fontFamily: "inherit",
    color: "#1f2937"
  },
  backBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  },
  // Empty State
  emptyState: {
    textAlign: "center",
    padding: "48px 20px"
  },
  emptyIcon: {
    fontSize: "24px",
    marginBottom: "12px",
    opacity: 0.3
  },
  emptyText: {
    fontSize: "13px",
    color: "#a8a29e",
    marginBottom: "4px"
  },
  // Loading & Alert
  loadingOverlay: {
    position: "fixed",
    inset: "0",
    background: "rgba(250,250,249,0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  alert: {
    marginBottom: "24px",
    borderRadius: "12px"
  }
};

function TaskCard({
  item,
  onSave,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
  deleting
}: {
  item: EditableItem;
  onSave: (item: EditableItem) => void;
  onDelete: (id: number) => void;
  onDragStart: (itemId: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  deleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(item.text_value);
  const [isHovered, setIsHovered] = useState(false);
  const ignoreBlurSaveRef = useRef(false);

  const handleSave = () => {
    onSave({ ...item, text_value: editedText });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(item.text_value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={styles.taskCard}>
        <div style={styles.editInline}>
          <input
            type="text"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            style={styles.editInput}
            autoFocus
            onBlur={() => {
              if (ignoreBlurSaveRef.current) {
                ignoreBlurSaveRef.current = false;
                return;
              }
              handleSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
              }
            }}
          />
          <button
            type="button"
            style={styles.backBtn}
            title="返回"
            onMouseDown={() => {
              ignoreBlurSaveRef.current = true;
            }}
            onClick={handleCancel}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 6l-6 6 6 6M5 12h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const isDone = item.status === 2;
  const contentText = item.text_value ?? "";

  return (
    <div
      style={{
        ...(isDone ? styles.taskCardDone : styles.taskCard),
        ...(isHovered ? (isDone ? styles.taskCardDoneHover : styles.taskCardHover) : {}),
        ...(isDragging ? styles.taskCardDragging : {})
      }}
      draggable
      onDoubleClick={() => setIsEditing(true)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(item.id));
        onDragStart(item.id);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.taskMainRow}>
        <div style={isDone ? styles.taskContentDone : styles.taskContent}>
          {contentText || <em style={{ color: "#a8a29e" }}>无内容</em>}
        </div>
        <div
          style={{
            ...styles.taskActions,
            ...(isHovered ? { opacity: 1, transform: "translateY(0)" } : {})
          }}
        >
          <div style={styles.taskActionGroup}>
            <button
              style={{
                ...styles.deleteBtn,
                ...(isHovered && !deleting ? styles.deleteBtnHover : {})
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              disabled={deleting}
              title="删除"
            >
              {deleting ? (
                "..."
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M9.5 11v6M14.5 11v6M8 7l1-2h6l1 2M7.5 7l.6 11.1c.03.53.47.94 1 .94h5.8c.53 0 .97-.41 1-.94L16.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSlotItem({
  slot,
  index,
  onUpdate,
  onRemove
}: {
  slot: EditableSlot;
  index: number;
  onUpdate: (index: number, field: keyof EditableSlot, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <div
        style={styles.slotItem}
        onClick={() => setIsEditing(true)}
      >
        <div style={styles.slotTimeDisplay}>
          <span>{slot.start_time}</span>
          <span style={{ color: "#d6d3d1" }}>→</span>
          <span>{slot.end_time}</span>
        </div>
        <button
          style={styles.slotDeleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={styles.slotItem}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
        <input
          type="time"
          value={slot.start_time}
          onChange={(e) => onUpdate(index, "start_time", e.target.value)}
          style={styles.slotTimeEdit}
        />
        <span style={{ color: "#d6d3d1" }}>→</span>
        <input
          type="time"
          value={slot.end_time}
          onChange={(e) => onUpdate(index, "end_time", e.target.value)}
          style={styles.slotTimeEdit}
        />
      </div>
      <button
        style={{ ...styles.slotDeleteBtn, color: "#57534e" }}
        onClick={() => setIsEditing(false)}
      >
        ✓
      </button>
    </div>
  );
}

// ==================== Main Component ====================
export default function Workday({ aiConfigured = true }: { aiConfigured?: boolean }) {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [_record, setRecord] = useState<DailyRecord | null>(null);
  const [timeSlots, setTimeSlots] = useState<EditableSlot[]>([]);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [dropStatus, setDropStatus] = useState<ItemStatus | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [aiDays, setAiDays] = useState<NormalizedWorkDay[]>([]);
  const [isAiMode, setIsAiMode] = useState(false);
  const [monthOverview, setMonthOverview] = useState<MonthOverviewResponse | null>(null);
  const [isNarrow, setIsNarrow] = useState(resolveIsNarrow);
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthValue(date));

  useEffect(() => {
    if (!aiConfigured && isAiMode) {
      setIsAiMode(false);
    }
  }, [aiConfigured, isAiMode]);

  const loadDay = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestJson<WorkDayResponse>(`/api/work/day?date=${date}`);
      setRecord(data.record);
      setTimeSlots(data.timeSlots.map(normalizeSlot));
      setItems(data.record.items.filter(i => i.item_type === 0).map(buildEditableItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    const loadMonthOverview = async () => {
      try {
        const data = await requestJson<MonthOverviewResponse>(
          `/api/work/month-overview?month=${calendarMonth}`
        );
        setMonthOverview(data);
      } catch {
        setMonthOverview(null);
      }
    };
    void loadMonthOverview();
  }, [calendarMonth]);

  useEffect(() => {
    setCalendarMonth(toMonthValue(date));
  }, [date]);

  useEffect(() => {
    const onResize = () => setIsNarrow(resolveIsNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!error) return;
    notification.error({
      message: "操作失败",
      description: error,
      placement: "bottomRight"
    });
    setError(null);
  }, [error]);

  const groupedItems = useMemo(() => {
    const groups: Record<ItemStatus, EditableItem[]> = { 0: [], 1: [], 2: [] };
    items.forEach((item) => groups[item.status].push(item));
    Object.keys(groups).forEach((key) => {
      groups[Number(key) as ItemStatus].sort((a, b) => a.sort - b.sort);
    });
    return groups;
  }, [items]);

  const handleAddSlot = () => {
    setTimeSlots((prev) => [
      ...prev,
      { id: 0, start_time: "09:00", end_time: "17:00", sort: prev.length }
    ]);
  };

  const handleRemoveSlot = (index: number) => {
    setTimeSlots((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSlot = (index: number, field: keyof EditableSlot, value: string | number) => {
    setTimeSlots((prev) =>
      prev.map((slot, idx) => (idx === index ? { ...slot, [field]: value } : slot))
    );
  };

  const handleSaveSlots = async () => {
    try {
      const payload = timeSlots.map((slot, index) => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        sort: Number.isFinite(slot.sort) ? slot.sort : index
      }));
      const updated = await requestJson<WorkSlot[]>(`/api/work/day/${date}/slots`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setTimeSlots(updated.map(normalizeSlot));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存时段失败");
    }
  };

  const handleCreateItem = async () => {
    const content = newTaskText.trim();
    if (!content) return;
    
    setCreatingItem(true);
    try {
      await requestJson(`/api/work/day/${date}/items`, {
        method: "POST",
        body: JSON.stringify({
          item_type: 0,
          status: 0,
          text_value: content
        })
      });
      setNewTaskText("");
      setComposerOpen(false);
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失败");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleSaveItem = async (item: EditableItem) => {
    try {
      await requestJson(`/api/work/items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: item.status,
          sort: item.sort,
          text_value: item.text_value.trim()
        })
      });
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleDeleteItem = async (id: number) => {
    setDeletingItemId(id);
    try {
      await requestJson(`/api/work/items/${id}`, { method: "DELETE" });
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleDropToStatus = async (targetStatus: ItemStatus) => {
    if (draggingItemId === null) return;
    const dragged = items.find((item) => item.id === draggingItemId);
    if (!dragged) {
      setDraggingItemId(null);
      setDropStatus(null);
      return;
    }

    if (dragged.status === targetStatus) {
      setDraggingItemId(null);
      setDropStatus(null);
      return;
    }

    if (targetStatus === 1 && !containsHttpUrl(dragged.text_value ?? "")) {
      setError("纯文本任务不能直接进入进行中，请先补充关联链接。");
      setDraggingItemId(null);
      setDropStatus(null);
      return;
    }

    await handleSaveItem({ ...dragged, status: targetStatus });
    setDraggingItemId(null);
    setDropStatus(null);
  };

  const handleAiParse = async () => {
    if (!aiConfigured) {
      setError("AI 配置不完整，请先到配置页填写 AI 配置");
      return;
    }
    if (!aiInput.trim()) {
      setError("请输入需要解析的内容");
      return;
    }
    setAiLoading(true);
    try {
      const data = await requestJson<NormalizedWorkList>("/api/work/normalize", {
        method: "POST",
        body: JSON.stringify({ text: aiInput.trim(), selectedDate: date })
      });
      setAiDays(data.days ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiDayDateChange = (index: number, value: string) => {
    setAiDays((prev) => prev.map((day, idx) => (idx === index ? { ...day, date: value } : day)));
  };

  const handleAiItemChange = (dayIndex: number, itemIndex: number, value: string) => {
    setAiDays((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        const items = day.items.map((item, itemIdx) =>
          itemIdx === itemIndex ? value : item
        );
        return { ...day, items };
      })
    );
  };

  const handleAiAddItem = (dayIndex: number) => {
    setAiDays((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex ? { ...day, items: [...day.items, ""] } : day
      )
    );
  };

  const handleAiRemoveItem = (dayIndex: number, itemIndex: number) => {
    setAiDays((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return { ...day, items: day.items.filter((_, i) => i !== itemIndex) };
      })
    );
  };

  const handleAiAddDay = () => {
    setAiDays((prev) => [...prev, { date, items: [""] }]);
  };

  const handleAiRemoveDay = (dayIndex: number) => {
    setAiDays((prev) => prev.filter((_, idx) => idx !== dayIndex));
  };

  const handleAiConfirm = async () => {
    if (!aiConfigured) {
      setError("AI 配置不完整，无法使用自然语言输入");
      return;
    }
    if (aiDays.length === 0) {
      setError("没有可提交的解析结果");
      return;
    }

    const payload = {
      days: aiDays
        .map((day) => ({
          date: day.date,
          items: day.items.map((item) => item.trim()).filter(Boolean)
        }))
        .filter((day) => day.date && day.items.length > 0)
    };

    if (payload.days.length === 0) {
      setError("请至少保留一个日期与一条事项");
      return;
    }

    setAiSubmitting(true);
    try {
      await requestJson("/api/work/batch-items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setAiInput("");
      setAiDays([]);
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量新增失败");
    } finally {
      setAiSubmitting(false);
    }
  };

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={styles.page}>
        {loading && (
          <div style={styles.loadingOverlay}>
            <Spin size="large" />
          </div>
        )}

        <div style={styles.container}>
          <div
            style={{
              ...styles.mainGrid,
              gridTemplateColumns: isNarrow ? "1fr" : "360px 1fr"
            }}
          >
            {/* Sidebar */}
            <aside
              style={{
                ...styles.sidebar,
                position: isNarrow ? "static" : "sticky"
              }}
            >
              <TaskCalendar
                value={date}
                onChange={setDate}
                statusItems={monthOverview?.days ?? []}
                onMonthChange={setCalendarMonth}
              />

              {/* Time Slots */}
              <div>
                <div style={styles.sectionTitle}>时间段</div>
                {timeSlots.length === 0 ? (
                  <div style={styles.slotEmpty}>
                    点击添加时间段
                  </div>
                ) : (
                  <div style={styles.slotList}>
                    {timeSlots.map((slot, index) => (
                      <TimeSlotItem
                        key={`${slot.id}-${index}`}
                        slot={slot}
                        index={index}
                        onUpdate={handleUpdateSlot}
                        onRemove={handleRemoveSlot}
                      />
                    ))}
                  </div>
                )}
                <button style={styles.addSlotBtn} onClick={handleAddSlot}>
                  + 添加时段
                </button>
                {timeSlots.length > 0 && (
                  <button style={styles.saveSlotsBtn} onClick={handleSaveSlots}>
                    保存时段
                  </button>
                )}
              </div>
            </aside>

            {/* Main Content */}
            <main style={styles.mainContent}>
              {/* Board */}
              <div style={styles.board}>
                {([0, 1, 2] as ItemStatus[]).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const groupItems = groupedItems[status];

                  return (
                    <div
                      key={status}
                      style={{
                        ...(status === 2 ? styles.columnDone : styles.column),
                        ...(dropStatus === status ? styles.columnDropActive : {})
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dropStatus !== status) setDropStatus(status);
                      }}
                      onDragLeave={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (!next || !e.currentTarget.contains(next)) {
                          setDropStatus((prev) => (prev === status ? null : prev));
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        await handleDropToStatus(status);
                      }}
                    >
                      <div style={styles.columnHeader}>
                        <div style={styles.columnTitle}>
                          <span style={{ ...styles.columnTitleText, color: config.color }}>
                            {config.label}
                          </span>
                          <span
                            style={{
                              ...styles.columnTitleCount,
                              color: "#6b7280",
                            }}
                          >
                            {groupItems.length}
                          </span>
                        </div>
                        <div style={styles.columnHeaderRight}>
                          {status === 0 ? (
                            <button
                              style={{
                                ...styles.composerTriggerBtn,
                                color: config.color
                              }}
                              onClick={() => setComposerOpen(true)}
                              title="新建任务或自然语言解析"
                              type="button"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.08)";
                                e.currentTarget.style.borderColor = "rgba(59,130,246,0.18)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.borderColor = "transparent";
                              }}
                            >
                              <svg style={styles.composerTriggerIcon} viewBox="0 0 24 24" fill="none">
                                <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                <path d="M12.5 6.5l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                          ) : (
                            <span style={{ width: "34px", height: "34px" }} />
                          )}
                        </div>
                      </div>

                      <div style={styles.taskList}>
                        {groupItems.length === 0 ? (
                          <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>—</div>
                            <div style={styles.emptyText}>暂无任务</div>
                          </div>
                        ) : (
                          groupItems.map((item) => (
                            <TaskCard
                              key={item.id}
                              item={item}
                              onSave={handleSaveItem}
                              onDelete={handleDeleteItem}
                              onDragStart={setDraggingItemId}
                              onDragEnd={() => {
                                setDraggingItemId(null);
                                setDropStatus(null);
                              }}
                              isDragging={draggingItemId === item.id}
                              deleting={deletingItemId === item.id}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        </div>
      </div>
      <Modal
        title={isAiMode ? "自然语言解析" : "添加新任务"}
        open={composerOpen}
        onCancel={() => {
          setComposerOpen(false);
          setNewTaskText("");
          setAiInput("");
          setAiDays([]);
        }}
        footer={null}
        centered
        width={860}
      >
        <div style={styles.composerModalBody}>
          <div style={styles.modeSwitch}>
            <button
              style={{
                ...styles.modeSwitchBtn,
                ...(!isAiMode ? styles.modeSwitchBtnActive : {})
              }}
              onClick={() => setIsAiMode(false)}
            >
              添加新任务
            </button>
            <button
              style={{
                ...styles.modeSwitchBtn,
                ...(isAiMode ? styles.modeSwitchBtnActive : {}),
                ...(!aiConfigured ? { opacity: 0.45, cursor: "not-allowed" } : {})
              }}
              onClick={() => {
                if (!aiConfigured) {
                  setError("AI 配置不完整，请先到配置页填写 AI 配置");
                  return;
                }
                setIsAiMode(true);
              }}
              disabled={!aiConfigured}
            >
              自然语言解析
            </button>
          </div>

          {!isAiMode ? (
            <>
              <textarea
                placeholder="输入任务内容（支持粘贴链接）"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                style={{
                  ...styles.aiTextarea,
                  minHeight: "128px"
                }}
              />
              <div style={styles.aiActions}>
                <button
                  style={{
                    ...styles.aiButton,
                    opacity: newTaskText.trim() ? 1 : 0.5,
                    cursor: newTaskText.trim() ? "pointer" : "not-allowed"
                  }}
                  onClick={handleCreateItem}
                  disabled={!newTaskText.trim() || creatingItem}
                >
                  {creatingItem ? "添加中..." : "+ 添加任务"}
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                placeholder="例如：今天整理了需求文档，完成了接口联调；明天继续补测试。"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                style={styles.aiTextarea}
              />
              <div style={styles.aiActions}>
                <button
                  style={{
                    ...styles.aiButton,
                    opacity: aiInput.trim() ? 1 : 0.5,
                    cursor: aiInput.trim() ? "pointer" : "not-allowed"
                  }}
                  onClick={handleAiParse}
                  disabled={!aiInput.trim() || aiLoading}
                >
                  {aiLoading ? "解析中..." : "生成预览"}
                </button>
                <button
                  style={styles.aiGhostButton}
                  onClick={() => {
                    setAiInput("");
                    setAiDays([]);
                  }}
                >
                  清空
                </button>
              </div>

              {aiDays.length > 0 && (
                <div style={styles.aiPreview}>
                  {aiDays.map((day, dayIndex) => (
                    <div key={`${day.date}-${dayIndex}`} style={styles.aiDayCard}>
                      <div style={styles.aiDayHeader}>
                        <div style={styles.aiDayTitle}>日期</div>
                        <input
                          type="date"
                          value={day.date}
                          onChange={(e) => handleAiDayDateChange(dayIndex, e.target.value)}
                          style={styles.datePicker}
                        />
                        <button
                          style={styles.aiIconButton}
                          onClick={() => handleAiRemoveDay(dayIndex)}
                        >
                          删除日期
                        </button>
                      </div>
                      {day.items.map((item, itemIndex) => (
                        <div key={`${dayIndex}-${itemIndex}`} style={styles.aiItemRow}>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => handleAiItemChange(dayIndex, itemIndex, e.target.value)}
                            style={styles.aiItemInput}
                            placeholder="事项内容"
                          />
                          <button
                            style={styles.aiIconButton}
                            onClick={() => handleAiRemoveItem(dayIndex, itemIndex)}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <button
                        style={styles.aiAddItemButton}
                        onClick={() => handleAiAddItem(dayIndex)}
                      >
                        + 添加事项
                      </button>
                    </div>
                  ))}

                  <div style={styles.aiFooter}>
                    <button style={styles.aiGhostButton} onClick={handleAiAddDay}>
                      + 添加日期
                    </button>
                    <span style={styles.aiCount}>
                      共 {aiDays.reduce((sum, day) => sum + day.items.length, 0)} 条事项
                    </span>
                    <button
                      style={{
                        ...styles.aiButton,
                        opacity: aiSubmitting ? 0.7 : 1
                      }}
                      onClick={handleAiConfirm}
                      disabled={aiSubmitting}
                    >
                      {aiSubmitting ? "提交中..." : "确认并批量新增"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
