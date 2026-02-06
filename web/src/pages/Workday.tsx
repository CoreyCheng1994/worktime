import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Input, InputNumber } from "../components/Input";
import { Select } from "../components/Select";
import { Spin } from "../components/Spin";
import { Alert } from "../components/Alert";
import { CSSProperties } from "react";

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
  0: { label: "待办", color: "#78716c", bg: "#fafaf9", border: "#e7e5e4" },
  1: { label: "进行中", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  2: { label: "已完成", color: "#15803d", bg: "#f0fdf4", border: "#86efac" }
};

const statusOptions = [
  { value: 0, label: "待办" },
  { value: 1, label: "进行中" },
  { value: 2, label: "已完成" }
];

// ==================== Utils ====================
const formatDate = (value: Date) => {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
};

const formatDisplayDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  
  return {
    full: dateStr,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday,
    isToday
  };
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

// ==================== Styles ====================
const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fafaf9",
    fontFamily: "'DM Sans', 'Noto Sans SC', -apple-system, sans-serif",
    color: "#292524"
  },
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "48px 32px"
  },
  // Header
  header: {
    marginBottom: "48px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px"
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  dateRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px"
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
    fontSize: "48px",
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
  todayBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    background: "#1c1917",
    color: "#fafaf9",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.05em"
  },
  refreshBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    color: "#57534e",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit"
  },
  // Stats
  statsBar: {
    display: "flex",
    gap: "8px",
    marginBottom: "32px"
  },
  statPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "100px",
    fontSize: "13px",
    fontWeight: 500
  },
  // Main Layout
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: "32px",
    alignItems: "start"
  },
  // Sidebar
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    position: "sticky",
    top: "32px"
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
    gap: "24px"
  },
  // Input Area
  inputCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.04)"
  },
  aiCard: {
    background: "linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)",
    borderRadius: "20px",
    padding: "28px",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)"
  },
  aiHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px"
  },
  aiTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#1f2937"
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
    minHeight: "120px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    background: "#fff",
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
    marginTop: "12px"
  },
  aiButton: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "#f9fafb",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  aiGhostButton: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "1px solid #cbd5f5",
    background: "#f8fafc",
    color: "#1f2937",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  aiHint: {
    fontSize: "12px",
    color: "#6b7280"
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
    border: "1px solid #e5e7eb",
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
  inputWrapper: {
    position: "relative"
  },
  taskInput: {
    width: "100%",
    padding: "16px 100px 16px 20px",
    fontSize: "16px",
    border: "2px solid #f5f5f4",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
    background: "#fafaf9",
    fontFamily: "inherit",
    color: "#292524"
  },
  taskInputFocus: {
    borderColor: "#d6d3d1",
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
    borderRadius: "8px",
    background: "#1c1917",
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
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px"
  },
  column: {
    background: "#f5f5f4",
    borderRadius: "16px",
    padding: "16px",
    minHeight: "450px"
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
    padding: "4px"
  },
  columnTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 600
  },
  columnDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%"
  },
  columnCount: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#78716c",
    background: "#fff",
    padding: "4px 10px",
    borderRadius: "100px"
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  // Task Card
  taskCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    border: "1px solid #f5f5f4",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer"
  },
  taskCardHover: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transform: "translateY(-1px)",
    borderColor: "#e7e5e4"
  },
  taskContent: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#292524",
    marginBottom: "12px",
    wordBreak: "break-word"
  },
  taskMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "12px",
    borderTop: "1px solid #fafaf9"
  },
  taskTime: {
    fontSize: "11px",
    color: "#a8a29e",
    fontWeight: 500
  },
  taskActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center"
  },
  actionBtn: {
    padding: "6px 12px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    color: "#57534e",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 500
  },
  deleteBtn: {
    padding: "6px 12px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#a8a29e",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  statusSelect: {
    minWidth: "90px"
  },
  // Edit Mode
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  editInput: {
    width: "100%",
    padding: "12px",
    fontSize: "14px",
    border: "1px solid #e7e5e4",
    borderRadius: "8px",
    outline: "none",
    fontFamily: "inherit"
  },
  editRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center"
  },
  editLabel: {
    fontSize: "13px",
    color: "#78716c",
    minWidth: "40px"
  },
  editActions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    marginTop: "4px"
  },
  editBtn: {
    padding: "8px 16px",
    fontSize: "13px",
    borderRadius: "6px"
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

// ==================== Components ====================
function TaskCard({
  item,
  onSave,
  onDelete,
  saving,
  deleting
}: {
  item: EditableItem;
  onSave: (item: EditableItem) => void;
  onDelete: (id: number) => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(item.text_value);
  const [editedSort, setEditedSort] = useState(item.sort);
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = () => {
    onSave({ ...item, text_value: editedText, sort: editedSort });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(item.text_value);
    setEditedSort(item.sort);
    setIsEditing(false);
  };

  const handleStatusChange = (newStatus: ItemStatus) => {
    if (newStatus !== item.status) {
      onSave({ ...item, status: newStatus });
    }
  };

  if (isEditing) {
    return (
      <div style={styles.taskCard}>
        <div style={styles.editForm}>
          <input
            type="text"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            style={styles.editInput}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div style={styles.editRow}>
            <span style={styles.editLabel}>排序</span>
            <InputNumber
              min={0}
              value={editedSort}
              onChange={(v) => setEditedSort(typeof v === "number" ? v : 0)}
              style={{ width: "80px" }}
              size="small"
            />
          </div>
          <div style={styles.editActions}>
            <Button style={styles.editBtn} onClick={handleCancel}>
              取消
            </Button>
            <Button type="primary" style={styles.editBtn} onClick={handleSave} loading={saving}>
              保存
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.taskCard,
        ...(isHovered ? styles.taskCardHover : {})
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.taskContent}>
        {item.text_value || <em style={{ color: "#a8a29e" }}>无内容</em>}
      </div>
      
      <div style={styles.taskMeta}>
        <span style={styles.taskTime}>
          {new Date(item.updated_time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
        
        <div style={styles.taskActions}>
          <Select
            value={item.status}
            options={statusOptions}
            onChange={(v) => handleStatusChange(Number(v) as ItemStatus)}
            style={styles.statusSelect}
            size="small"
          />
          <button style={styles.actionBtn} onClick={() => setIsEditing(true)}>
            编辑
          </button>
          <button style={styles.deleteBtn} onClick={() => onDelete(item.id)} disabled={deleting}>
            {deleting ? "..." : "删除"}
          </button>
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
export default function Workday() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [timeSlots, setTimeSlots] = useState<EditableSlot[]>([]);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [aiDays, setAiDays] = useState<NormalizedWorkDay[]>([]);

  const dateInfo = useMemo(() => formatDisplayDate(date), [date]);

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

  const groupedItems = useMemo(() => {
    const groups: Record<ItemStatus, EditableItem[]> = { 0: [], 1: [], 2: [] };
    items.forEach((item) => groups[item.status].push(item));
    Object.keys(groups).forEach((key) => {
      groups[Number(key) as ItemStatus].sort((a, b) => a.sort - b.sort);
    });
    return groups;
  }, [items]);

  const stats = useMemo(() => ({
    total: items.length,
    todo: groupedItems[0].length,
    inProgress: groupedItems[1].length,
    done: groupedItems[2].length
  }), [groupedItems, items.length]);

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
    if (!newTaskText.trim()) return;
    
    setCreatingItem(true);
    try {
      await requestJson(`/api/work/day/${date}/items`, {
        method: "POST",
        body: JSON.stringify({
          item_type: 0,
          status: 0,
          text_value: newTaskText.trim()
        })
      });
      setNewTaskText("");
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失败");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleSaveItem = async (item: EditableItem) => {
    setSavingItemId(item.id);
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
    } finally {
      setSavingItemId(null);
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

  const handleAiParse = async () => {
    if (!aiInput.trim()) {
      setError("请输入需要解析的内容");
      return;
    }
    setAiLoading(true);
    try {
      const data = await requestJson<NormalizedWorkList>("/api/work/normalize", {
        method: "POST",
        body: JSON.stringify({ text: aiInput.trim() })
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreateItem();
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
          {/* Header */}
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.dateRow}>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={styles.datePicker}
                />
                {dateInfo.isToday && <span style={styles.todayBadge}>今天</span>}
              </div>
              <div style={styles.dateDisplay}>
                <span style={styles.dateMain}>{dateInfo.month}月{dateInfo.day}日</span>
                <span style={styles.dateSub}>周{dateInfo.weekday}</span>
              </div>
            </div>
            <button style={styles.refreshBtn} onClick={loadDay}>
              刷新
            </button>
          </header>

          {/* Stats */}
          <div style={styles.statsBar}>
            <div style={{ ...styles.statPill, background: STATUS_CONFIG[0].bg, color: STATUS_CONFIG[0].color }}>
              <span>待办</span>
              <span style={{ fontWeight: 700 }}>{stats.todo}</span>
            </div>
            <div style={{ ...styles.statPill, background: STATUS_CONFIG[1].bg, color: STATUS_CONFIG[1].color }}>
              <span>进行中</span>
              <span style={{ fontWeight: 700 }}>{stats.inProgress}</span>
            </div>
            <div style={{ ...styles.statPill, background: STATUS_CONFIG[2].bg, color: STATUS_CONFIG[2].color }}>
              <span>已完成</span>
              <span style={{ fontWeight: 700 }}>{stats.done}</span>
            </div>
          </div>

          {error && (
            <Alert
              style={styles.alert}
              type="error"
              showIcon
              message="操作失败"
              description={error}
              closable
              onClose={() => setError(null)}
            />
          )}

          <div style={styles.mainGrid}>
            {/* Sidebar */}
            <aside style={styles.sidebar}>
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
              {/* AI Parser */}
              <section style={styles.aiCard}>
                <div style={styles.aiHeader}>
                  <div style={styles.aiTitle}>自然语言解析</div>
                  <span style={styles.aiBadge}>OpenAI</span>
                </div>
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
                  <span style={styles.aiHint}>
                    解析结果可编辑，确认后批量新增到工作记录。
                  </span>
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
                              onChange={(e) =>
                                handleAiItemChange(dayIndex, itemIndex, e.target.value)
                              }
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
              </section>

              {/* Input */}
              <div style={styles.inputCard}>
                <div style={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="添加新任务..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={handleKeyDown}
                    style={{
                      ...styles.taskInput,
                      ...(isInputFocused ? styles.taskInputFocus : {})
                    }}
                  />
                  <button
                    style={{
                      ...styles.addBtn,
                      opacity: newTaskText.trim() ? 1 : 0.5,
                      cursor: newTaskText.trim() ? "pointer" : "not-allowed"
                    }}
                    onClick={handleCreateItem}
                    disabled={!newTaskText.trim() || creatingItem}
                  >
                    {creatingItem ? "..." : "添加"}
                  </button>
                </div>
                <div style={styles.inputHint}>按 Enter 快速添加</div>
              </div>

              {/* Board */}
              <div style={styles.board}>
                {([0, 1, 2] as ItemStatus[]).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const groupItems = groupedItems[status];

                  return (
                    <div key={status} style={styles.column}>
                      <div style={styles.columnHeader}>
                        <div style={styles.columnTitle}>
                          <span style={{ ...styles.columnDot, background: config.color }} />
                          <span style={{ color: config.color }}>{config.label}</span>
                        </div>
                        <span style={styles.columnCount}>{groupItems.length}</span>
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
                              saving={savingItemId === item.id}
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
    </>
  );
}
