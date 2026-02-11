import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const envRoot = path.resolve(process.cwd(), "..");
  const env = loadEnv(mode, envRoot, "");
  const webPort = Number(env.WEB_PORT || env.VITE_WEB_PORT || 13018);
  const apiPort = Number(env.API_PORT || env.VITE_API_PORT || 13019);

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: "./vitest.setup.ts",
      include: ["src/**/*.{test,spec}.{ts,tsx}"]
    },
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
