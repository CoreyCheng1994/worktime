import "dotenv/config";
import "reflect-metadata";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { createWorktimeMcpServer } from "./mcp/worktime-mcp";
import { ensureRuntimeConfigFile, loadRuntimeConfig } from "./system/runtime-config";

async function bootstrap() {
  ensureRuntimeConfigFile();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "warn", "error"]
  });
  app.setGlobalPrefix("api");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Worktime API")
    .setDescription("工作记录与时间区间 API")
    .setVersion("1.0.0")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction
    ? Number(process.env.API_PORT || 13119)
    : Number(process.env.DEV_API_PORT || process.env.API_PORT || 13019);
  const localApiBaseUrl = `http://127.0.0.1:${port}/api`;
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.post("/mcp", async (req: { body?: unknown }, res: unknown) => {
    if (!loadRuntimeConfig().mcp.enabled) {
      const fallback = res as { status?: (code: number) => { json: (body: unknown) => void } };
      fallback.status?.(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "MCP is disabled by configuration."
        },
        id: null
      });
      return;
    }

    const server = createWorktimeMcpServer({ apiBaseUrl: localApiBaseUrl });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req as never, res as never, req.body as never);
      (res as { on?: (event: string, listener: () => void) => void }).on?.("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      void transport.close();
      void server.close();
      const fallback = res as { headersSent?: boolean; status?: (code: number) => { json: (body: unknown) => void } };
      if (!fallback.headersSent && fallback.status) {
        fallback.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  expressApp.get("/mcp", (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  expressApp.delete("/mcp", (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  const webDistDir = join(__dirname, "../../web/dist");
  if (existsSync(webDistDir)) {
    app.useStaticAssets(webDistDir);

    expressApp.get("*", (req: { path: string }, res: { sendFile: (filePath: string) => void }, next: () => void) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/docs") || req.path.startsWith("/mcp")) {
        next();
        return;
      }

      res.sendFile(join(webDistDir, "index.html"));
    });
  }

  await app.listen(port);
}

void bootstrap();
