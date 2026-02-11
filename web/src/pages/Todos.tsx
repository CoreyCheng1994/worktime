import { useEffect, useMemo } from "react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Empty } from "../components/Empty";
import { Spin } from "../components/Spin";
import { Paragraph, Text, Title } from "../components/Typography";
import { useTodosPageStore } from "../stores/todosPage";
import "../styles/todos.css";

export default function Todos() {
  const {
    status,
    title,
    message,
    lastUpdated,
    lastUpdatedLabel,
    primaryActionLabel,
    primaryActionEnabled,
    secondaryActionLabel,
    secondaryActionEnabled,
    bootstrap,
    setError,
    reset
  } = useTodosPageStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return "-";
    return new Date(lastUpdated).toLocaleString();
  }, [lastUpdated]);

  const showSecondary = secondaryActionLabel.length > 0;
  const showActions = status !== "loading";

  const handlePrimary = () => {
    void bootstrap();
  };

  const handleSecondary = () => {
    if (status === "error") {
      reset();
      return;
    }
    setError();
  };

  return (
    <Card
      className="todos-card"
      title={
        <Title level={3} className="page-title">
          {title}
        </Title>
      }
    >
      {status === "loading" && (
        <div className="state-block">
          <Spin size="large" />
          <Text className="state-text">{message}</Text>
        </div>
      )}

      {status === "empty" && (
        <div className="state-block">
          <Empty description={message} />
        </div>
      )}

      {status === "error" && (
        <div className="state-block">
          <Alert type="error" showIcon message={title} description={message} />
        </div>
      )}

      {status === "ready" && (
        <div className="state-block">
          <Card type="inner">
            <Paragraph>{message}</Paragraph>
            <Text type="secondary">
              {lastUpdatedLabel}: {lastUpdatedText}
            </Text>
          </Card>
        </div>
      )}

      {showActions && (
        <div className="actions">
          <Button type="primary" disabled={!primaryActionEnabled} onClick={handlePrimary}>
            {primaryActionLabel}
          </Button>
          {showSecondary && (
            <Button disabled={!secondaryActionEnabled} onClick={handleSecondary}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
