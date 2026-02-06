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
          colorPrimary: "#2F5D3F",
          colorBgBase: "#F6F2EB",
          borderRadius: 8,
          fontSize: 14,
          fontFamily:
            "\"LXGW WenKai\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif"
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
