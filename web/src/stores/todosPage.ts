import { create } from "zustand";

export type TodosStatus = "loading" | "empty" | "error" | "ready";

interface TodosPageState {
  status: TodosStatus;
  title: string;
  message: string;
  lastUpdated: number | null;
  lastUpdatedLabel: string;
  primaryActionLabel: string;
  primaryActionEnabled: boolean;
  secondaryActionLabel: string;
  secondaryActionEnabled: boolean;
  bootstrap: () => Promise<void>;
  setError: (msg?: string) => void;
  reset: () => void;
}

const now = () => Date.now();

const loadingState = () => ({
  status: "loading" as TodosStatus,
  title: "正在加载",
  message: "正在准备你的待办页，请稍候。",
  lastUpdated: null,
  lastUpdatedLabel: "最近更新",
  primaryActionLabel: "",
  primaryActionEnabled: false,
  secondaryActionLabel: "",
  secondaryActionEnabled: false
});

export const useTodosPageStore = create<TodosPageState>((set) => ({
  ...loadingState(),
  bootstrap: async () => {
    set(loadingState());

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 900);
    });

    const toReady = Math.random() > 0.5;
    if (toReady) {
      set({
        status: "ready",
        title: "今日待办（占位）",
        message: "Blank - to be implemented",
        lastUpdatedLabel: "最近更新",
        primaryActionLabel: "刷新",
        primaryActionEnabled: true,
        secondaryActionLabel: "模拟错误",
        secondaryActionEnabled: true,
        lastUpdated: now()
      });
      return;
    }

    set({
      status: "empty",
      title: "暂无待办",
      message: "这里还没有任何条目。",
      lastUpdatedLabel: "最近更新",
      primaryActionLabel: "刷新",
      primaryActionEnabled: true,
      secondaryActionLabel: "模拟错误",
      secondaryActionEnabled: true,
      lastUpdated: now()
    });
  },
  setError: (msg) => {
    set({
      status: "error",
      title: "加载失败",
      message: msg ?? "当前无法获取待办数据。",
      lastUpdatedLabel: "最近更新",
      primaryActionLabel: "重试",
      primaryActionEnabled: true,
      secondaryActionLabel: "重置",
      secondaryActionEnabled: true,
      lastUpdated: now()
    });
  },
  reset: () => {
    set({
      status: "empty",
      title: "已重置",
      message: "页面状态已恢复为初始空状态。",
      lastUpdatedLabel: "最近更新",
      primaryActionLabel: "刷新",
      primaryActionEnabled: true,
      secondaryActionLabel: "模拟错误",
      secondaryActionEnabled: true,
      lastUpdated: now()
    });
  }
}));
