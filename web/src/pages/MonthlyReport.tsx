import type { CSSProperties} from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Spin } from "../components/Spin";

interface MonthlyReportResponse {
  month: string;
  totalHours: number;
  weeks: Array<{
    startDate: string;
    endDate: string;
    hours: number;
    days: Array<{
      date: string;
      timeSlots: Array<{ start_time: string; end_time: string }>;
      items: string[];
      hours: number;
    }>;
  }>;
  text: string;
}

const formatMonthValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

const requestJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    const message = (await resolveErrorMessage(response)) ?? `请求失败 (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as T;
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f1ea",
    fontFamily: "'DM Sans', 'Noto Sans SC', -apple-system, sans-serif",
    color: "#1f2937"
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "48px 32px"
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px",
    marginBottom: "28px"
  },
  titleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  title: {
    fontFamily: "'Playfair Display', 'Noto Serif SC', serif",
    fontSize: "38px",
    fontWeight: 600,
    margin: 0,
    color: "#1f2937"
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "#5b6472"
  },
  controls: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  monthInput: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e7e2d8",
    background: "#ffffff",
    fontSize: "14px",
    color: "#5b6472",
    cursor: "pointer",
    outline: "none",
    fontFamily: "inherit"
  },
  summary: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "24px"
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #e7e2d8",
    borderRadius: "12px",
    padding: "14px 18px",
    minWidth: "140px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
  },
  summaryLabel: {
    fontSize: "12px",
    color: "#8a93a1",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "6px"
  },
  summaryValue: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937"
  },
  reportCard: {
    background: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e7e2d8",
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    padding: "20px"
  },
  reportGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
    gap: "20px"
  },
  reportGridSingle: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "20px"
  },
  reportHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
    flexWrap: "wrap"
  },
  reportTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#5b6472",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    margin: 0
  },
  reportText: {
    whiteSpace: "pre-wrap",
    fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
    fontSize: "13px",
    lineHeight: 1.7,
    background: "#fbfaf7",
    border: "1px dashed #d5cebf",
    borderRadius: "12px",
    padding: "16px",
    minHeight: "240px"
  },
  helperRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    color: "#5b6472",
    fontSize: "12px",
    marginTop: "8px"
  },
  weekCard: {
    border: "1px solid #e7e2d8",
    borderRadius: "14px",
    padding: "16px",
    background: "#fbfaf7"
  },
  weekTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  weekHours: {
    fontSize: "12px",
    color: "#5b6472",
    fontWeight: 500
  },
  dayList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "12px"
  },
  dayCard: {
    padding: "12px",
    borderRadius: "12px",
    background: "#ffffff",
    border: "1px solid #e7e2d8"
  },
  dayTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937"
  },
  dayMeta: {
    fontSize: "12px",
    color: "#8a93a1",
    marginTop: "4px"
  },
  itemList: {
    margin: "10px 0 0",
    paddingLeft: "18px",
    color: "#1f2937",
    lineHeight: 1.6,
    fontSize: "13px"
  },
  emptyItem: {
    fontSize: "12px",
    color: "#8a93a1",
    marginTop: "8px"
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  }
};

const resolveIsNarrow = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
};

export default function MonthlyReport() {
  const [month, setMonth] = useState(() => formatMonthValue(new Date()));
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isNarrow, setIsNarrow] = useState(resolveIsNarrow);

  const fetchReport = useCallback(async (targetMonth: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestJson<MonthlyReportResponse>(`/api/work/month?month=${targetMonth}`);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(month);
  }, [month, fetchReport]);

  useEffect(() => {
    const onResize = () => setIsNarrow(resolveIsNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const summary = useMemo(() => {
    if (!report) return null;
    const weekCount = report.weeks.length;
    const dayCount = report.weeks.reduce((sum, week) => sum + week.days.length, 0);
    return { weekCount, dayCount };
  }, [report]);

  const handleCopy = async () => {
    if (!report?.text) return;
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={styles.page}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.titleGroup}>
            <h1 style={styles.title}>月度工作报表</h1>
            <p style={styles.subtitle}>按周聚合展示当月工时与每日工作内容。</p>
          </div>
          <div style={styles.controls}>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={styles.monthInput}
            />
            <Button onClick={() => fetchReport(month)}>生成月报</Button>
          </div>
        </header>

        {error && (
          <Alert
            type="error"
            showIcon
            message="加载失败"
            description={error}
            style={{ marginBottom: "20px" }}
          />
        )}

        {loading && <Spin size="large" />}

        {report && summary && !loading && (
          <>
            <div style={styles.summary}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>月份</div>
                <div style={styles.summaryValue}>{report.month}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>总工时</div>
                <div style={styles.summaryValue}>{report.totalHours} 小时</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>周数</div>
                <div style={styles.summaryValue}>{summary.weekCount}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>天数</div>
                <div style={styles.summaryValue}>{summary.dayCount}</div>
              </div>
            </div>

            <section style={styles.reportCard}>
              <div style={styles.reportHeader}>
                <p style={styles.reportTitle}>结构化预览</p>
                <Button onClick={handleCopy}>{copied ? "已复制" : "复制 Markdown"}</Button>
              </div>
              <div style={isNarrow ? styles.reportGridSingle : styles.reportGrid}>
                <div style={styles.stack}>
                  {report.weeks.map((week) => (
                    <div key={`${week.startDate}-${week.endDate}`} style={styles.weekCard}>
                      <p style={styles.weekTitle}>
                        <span>
                          {week.startDate === week.endDate
                            ? week.startDate.replace(/^\\d{4}-/, "").replace("-", "/")
                            : `${week.startDate.replace(/^\\d{4}-/, "").replace("-", "/")} ~ ${week.endDate
                                .replace(/^\\d{4}-/, "")
                                .replace("-", "/")}`}
                        </span>
                        <span style={styles.weekHours}>{week.hours} 小时</span>
                      </p>
                      <div style={styles.dayList}>
                        {week.days.map((day) => (
                          <div key={day.date} style={styles.dayCard}>
                            <p style={styles.dayTitle}>
                              {day.date.replace(/^\\d{4}-/, "").replace("-", "/")},{" "}
                              {day.timeSlots
                                .map(
                                  (slot) =>
                                    `${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
                                )
                                .join("、")}
                            </p>
                            <div style={styles.dayMeta}>{day.hours} 小时</div>
                            {day.items.length === 0 ? (
                              <div style={styles.emptyItem}>暂无内容</div>
                            ) : (
                              <ul style={styles.itemList}>
                                {day.items.map((item, index) => (
                                  <li key={`${day.date}-${index}`}>{item}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={styles.reportTitle}>Markdown 文本</p>
                  <div style={styles.reportText}>{report.text}</div>
                  <div style={styles.helperRow}>正文为 Markdown 格式，可直接复制导出。</div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
