import "antd/dist/reset.css";
import "./styles/base.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";

import App from "./App";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#3b82f6",
          colorBgBase: "#f4f1ea",
          colorTextBase: "#1f2937",
          colorBorder: "#e7e2d8",
          borderRadius: 10,
          fontSize: 14,
          fontFamily:
            "\"Space Grotesk\", \"PingFang SC\", \"Noto Sans SC\", sans-serif"
        },
        algorithm: antdTheme.defaultAlgorithm
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
