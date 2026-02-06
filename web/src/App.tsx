import { Layout, Typography } from "antd";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Todos from "./pages/Todos";
import Workday from "./pages/Workday";
import MonthlyReport from "./pages/MonthlyReport";
import "./styles/app.css";

const { Header, Content } = Layout;

export default function App() {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Typography.Title level={4} className="app-title">
          Worktime
        </Typography.Title>
        <nav className="app-nav">
          <NavLink
            to="/work"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
          >
            工作台
          </NavLink>
          <NavLink
            to="/todos"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
          >
            Todos
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
          >
            月报
          </NavLink>
        </nav>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/work" replace />} />
          <Route path="/work" element={<Workday />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/report" element={<MonthlyReport />} />
        </Routes>
      </Content>
    </Layout>
  );
}
