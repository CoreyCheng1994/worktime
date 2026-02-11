import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Input, InputNumber, Row, Space, Switch, Typography, message } from "antd";

interface SystemConfigResponse {
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  ai: {
    url: string;
    key: string;
    model: string;
    timezone: string;
  };
  mcp: {
    enabled: boolean;
  };
  configDir: string;
  configPath: string;
  updatedAt: string;
}

interface SystemStatusResponse {
  dbConfigured: boolean;
  aiConfigured: boolean;
  dbConnected: boolean;
  mcpEnabled: boolean;
  configDir: string;
  configPath: string;
}

type McpClientId = "codex" | "claude" | "gemini" | "kimi";

interface McpClientStatus {
  id: McpClientId;
  label: string;
  configPath: string;
  installed: boolean;
  configExists: boolean;
  enabled: boolean;
  manageable: boolean;
  error?: string;
}

interface SystemMcpClientsResponse {
  serverRouteEnabled: boolean;
  clients: McpClientStatus[];
}

interface SettingsProps {
  onConfigSaved?: () => Promise<void> | void;
}

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    let reason = `请求失败 (${response.status})`;
    try {
      const data = await response.json();
      if (Array.isArray(data?.message)) {
        reason = data.message.join(";");
      } else if (data?.message) {
        reason = String(data.message);
      }
    } catch {
      // ignore
    }
    throw new Error(reason);
  }
  return (await response.json()) as T;
};

export default function Settings({ onConfigSaved }: SettingsProps) {
  const [config, setConfig] = useState<SystemConfigResponse | null>(null);
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [mcpClients, setMcpClients] = useState<McpClientStatus[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingMcp, setTogglingMcp] = useState(false);
  const [switchingClientMcp, setSwitchingClientMcp] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, st, mcpData] = await Promise.all([
        requestJson<SystemConfigResponse>("/api/system/config"),
        requestJson<SystemStatusResponse>("/api/system/config/status"),
        requestJson<SystemMcpClientsResponse>("/api/system/mcp/clients")
      ]);
      setConfig(cfg);
      setStatus(st);
      setMcpClients(mcpData.clients);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dbAlert = useMemo(() => {
    if (!status) return null;
    if (!status.dbConfigured) {
      return <Alert type="error" showIcon message="数据库配置不完整，必须先填写。" />;
    }
    if (!status.dbConnected) {
      return <Alert type="warning" showIcon message="数据库参数已填写，但连接失败，请检查服务与账号权限。" />;
    }
    return <Alert type="success" showIcon message="数据库配置完整且连接正常。" />;
  }, [status]);

  const aiAlert = useMemo(() => {
    if (!status) return null;
    if (!status.aiConfigured) {
      return <Alert type="warning" showIcon message="AI 配置不完整，自然语言输入功能将被禁用。" />;
    }
    return <Alert type="success" showIcon message="AI 配置可用，自然语言输入已启用。" />;
  }, [status]);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await requestJson<SystemConfigResponse>("/api/system/config", {
        method: "PUT",
        body: JSON.stringify({
          db: config.db,
          ai: config.ai
        })
      });
      await loadData();
      await onConfigSaved?.();
      message.success("配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleMcp = async (enabled: boolean) => {
    setTogglingMcp(true);
    try {
      await requestJson<SystemConfigResponse>("/api/system/config", {
        method: "PUT",
        body: JSON.stringify({ mcp: { enabled } })
      });
      await loadData();
      await onConfigSaved?.();
      message.success(enabled ? "已启用 MCP" : "已关闭 MCP");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切换 MCP 失败");
    } finally {
      setTogglingMcp(false);
    }
  };

  const setClientMcp = async (enabled: boolean, clientIds?: McpClientId[]) => {
    setSwitchingClientMcp(true);
    try {
      const endpoint = enabled ? "/api/system/mcp/clients/enable" : "/api/system/mcp/clients/disable";
      const data = await requestJson<{ clients: McpClientStatus[] }>(endpoint, {
        method: "POST",
        body: JSON.stringify(clientIds && clientIds.length ? { clients: clientIds } : {})
      });
      setMcpClients(data.clients);
      message.success(enabled ? "已启用 CLI MCP" : "已关闭 CLI MCP");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切换 CLI MCP 失败");
    } finally {
      setSwitchingClientMcp(false);
    }
  };

  const allEnabled = useMemo(() => mcpClients.length > 0 && mcpClients.every((item) => item.enabled), [mcpClients]);

  if (!config) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={3}>系统配置</Typography.Title>
        <Alert type="info" showIcon message={loading ? "配置加载中..." : "无法加载配置"} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>系统配置</Typography.Title>
        <Typography.Text type="secondary">配置文件：{config.configPath}</Typography.Text>

        {dbAlert}
        {aiAlert}

        <Card title="MySQL 配置" bordered>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Typography.Text>Host</Typography.Text>
              <Input
                value={config.db.host}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, db: { ...prev.db, host: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>Port</Typography.Text>
              <InputNumber
                value={config.db.port}
                onChange={(value) => setConfig((prev) => prev ? { ...prev, db: { ...prev.db, port: Number(value || 0) } } : prev)}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>User</Typography.Text>
              <Input
                value={config.db.user}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, db: { ...prev.db, user: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>Password</Typography.Text>
              <Input.Password
                value={config.db.password}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, db: { ...prev.db, password: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>Database</Typography.Text>
              <Input
                value={config.db.name}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, db: { ...prev.db, name: e.target.value } } : prev)}
              />
            </Col>
          </Row>
        </Card>

        <Card title="AI 配置" bordered>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Typography.Text>AI URL</Typography.Text>
              <Input
                value={config.ai.url}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, ai: { ...prev.ai, url: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>AI Key</Typography.Text>
              <Input.Password
                value={config.ai.key}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, ai: { ...prev.ai, key: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>AI Model</Typography.Text>
              <Input
                value={config.ai.model}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, ai: { ...prev.ai, model: e.target.value } } : prev)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>Timezone</Typography.Text>
              <Input
                value={config.ai.timezone}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, ai: { ...prev.ai, timezone: e.target.value } } : prev)}
              />
            </Col>
          </Row>
        </Card>

        <Card title="服务端 MCP 路由开关" bordered>
          <Space align="center" size={12}>
            <Switch
              checked={Boolean(config.mcp.enabled)}
              loading={togglingMcp}
              onChange={(checked) => void toggleMcp(checked)}
            />
            <Typography.Text>{config.mcp.enabled ? "已启用" : "已关闭"}</Typography.Text>
            <Typography.Text type="secondary">（控制 /mcp 路由）</Typography.Text>
          </Space>
        </Card>

        <Card title="本机 AI CLI MCP 集成" bordered>
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space align="center" size={12}>
              <Switch
                checked={allEnabled}
                loading={switchingClientMcp}
                disabled={!mcpClients.length}
                onChange={(checked) => void setClientMcp(checked)}
              />
              <Typography.Text>一键{allEnabled ? "关闭" : "启用"}全部客户端</Typography.Text>
            </Space>

            {mcpClients.map((client) => (
              <Card
                key={client.id}
                size="small"
                style={{ borderRadius: 10 }}
                bodyStyle={{ padding: "10px 12px" }}
              >
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                    <Space align="center" size={8}>
                      <Typography.Text strong>{client.label}</Typography.Text>
                      <Typography.Text type="secondary">{client.enabled ? "已启用" : "已关闭"}</Typography.Text>
                    </Space>
                    <Switch
                      checked={client.enabled}
                      loading={switchingClientMcp}
                      disabled={!client.manageable || switchingClientMcp}
                      onChange={(checked) => void setClientMcp(checked, [client.id])}
                    />
                  </Space>
                  <Typography.Text type="secondary">{client.configPath}</Typography.Text>
                  {!client.manageable ? (
                    <Alert type="warning" showIcon message={client.error ?? "未检测到客户端安装"} />
                  ) : null}
                  {client.error && client.manageable ? <Alert type="error" showIcon message={client.error} /> : null}
                </Space>
              </Card>
            ))}
          </Space>
        </Card>

        <Space>
          <Button type="primary" loading={saving} onClick={() => void saveConfig()}>
            保存数据库与 AI 配置
          </Button>
          <Button onClick={() => void loadData()}>刷新状态</Button>
        </Space>
      </Space>
    </div>
  );
}
