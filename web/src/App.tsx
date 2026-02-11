import { useCallback, useEffect, useState } from "react";
import { Layout, Modal, Typography } from "antd";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Workday from "./pages/Workday";
import MonthlyReport from "./pages/MonthlyReport";
import Settings from "./pages/Settings";
import "./styles/app.css";

const { Sider, Content } = Layout;

export default function App() {
  const [status, setStatus] = useState<{
    dbConfigured: boolean;
    aiConfigured: boolean;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const refreshStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch("/api/system/config/status");
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const data = (await response.json()) as { dbConfigured: boolean; aiConfigured: boolean };
      setStatus(data);
    } catch {
      setStatus({ dbConfigured: false, aiConfigured: false });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const dbForceConfig = !checkingStatus && Boolean(status) && !status.dbConfigured;

  return (
    <Layout className="app-shell">
      <Modal
        title="必须先完成数据库配置"
        open={dbForceConfig}
        closable={false}
        maskClosable={false}
        keyboard={false}
        cancelButtonProps={{ style: { display: "none" } }}
        okText="前往配置页"
        onOk={() => {
          if (location.pathname !== "/settings") {
            navigate("/settings");
          }
        }}
      >
        检测到 MySQL 配置不完整。请先在配置页填写完整数据库信息，保存后才能正常使用工作台。
      </Modal>

      <Sider className="app-sider" width={168}>
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.9" />
              <path d="M12 2.5V5.2M12 18.8V21.5M2.5 12H5.2M18.8 12h2.7M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </span>
          <Typography.Title level={4} className="app-title" title="Worktime">
            Worktime
          </Typography.Title>
        </div>
        <nav className="app-nav">
          <NavLink
            to="/work"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
            title="工作台"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 11.5L12 4l8 7.5V20h-6.2v-5.2h-3.6V20H4v-8.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
            title="月报"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 19h14M8 15v-5M12 15V6M16 15v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
            title="配置"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 12h2.2m12.6 0h2.2M12 3.5v2.2M12 18.3v2.2M5.8 5.8l1.5 1.5m9.4 9.4 1.5 1.5m0-12.4-1.5 1.5m-9.4 9.4-1.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </NavLink>
        </nav>
      </Sider>

      <Content className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/work" replace />} />
          <Route path="/work" element={<Workday aiConfigured={Boolean(status?.aiConfigured)} />} />
          <Route path="/todos" element={<Navigate to="/work" replace />} />
          <Route path="/report" element={<MonthlyReport />} />
          <Route path="/settings" element={<Settings onConfigSaved={refreshStatus} />} />
        </Routes>
      </Content>
    </Layout>
  );
}
