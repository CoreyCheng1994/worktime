import { BadRequestException, Controller, Get, Put, Body } from "@nestjs/common";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RuntimeConfigPatch,
  ensureRuntimeConfigFile,
  getRuntimeConfigPath,
  getWorktimeHomeDir,
  isAiConfigured,
  isDbConfigured,
  loadRuntimeConfig,
  patchRuntimeConfig
} from "./runtime-config";
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

@Controller("system/config")
export class SystemConfigController {
  @Get()
  getConfig() {
    const config = ensureRuntimeConfigFile();
    return {
      ...config,
      configDir: getWorktimeHomeDir(),
      configPath: getRuntimeConfigPath()
    };
  }

  @Put()
  async updateConfig(@Body() patch: RuntimeConfigPatch) {
    if (!patch || typeof patch !== "object") {
      throw new BadRequestException("请求体不能为空");
    }

    if (patch.db?.port !== undefined && (!Number.isFinite(Number(patch.db.port)) || Number(patch.db.port) <= 0)) {
      throw new BadRequestException("db.port 必须为正整数");
    }

    if (patch.work?.defaultSlots !== undefined) {
      if (!Array.isArray(patch.work.defaultSlots) || patch.work.defaultSlots.length === 0) {
        throw new BadRequestException("work.defaultSlots 必须为非空数组");
      }
      patch.work.defaultSlots.forEach((slot, index) => {
        if (!slot || typeof slot !== "object") {
          throw new BadRequestException(`work.defaultSlots[${index}] 不能为空`);
        }
        if (typeof slot.start !== "string" || !TIME_PATTERN.test(slot.start)) {
          throw new BadRequestException(`work.defaultSlots[${index}].start 格式必须为 HH:mm 或 HH:mm:ss`);
        }
        if (typeof slot.end !== "string" || !TIME_PATTERN.test(slot.end)) {
          throw new BadRequestException(`work.defaultSlots[${index}].end 格式必须为 HH:mm 或 HH:mm:ss`);
        }
        const start = this.normalizeTime(slot.start);
        const end = this.normalizeTime(slot.end);
        if (this.timeToSeconds(start) >= this.timeToSeconds(end)) {
          throw new BadRequestException(`work.defaultSlots[${index}] start 必须早于 end`);
        }
      });
    }

    const normalizedPatch: RuntimeConfigPatch = {
      db: patch.db
        ? {
            ...patch.db,
            port: patch.db.port === undefined ? undefined : Number(patch.db.port)
          }
        : undefined,
      ai: patch.ai,
      mcp: patch.mcp,
      work: patch.work?.defaultSlots
        ? {
            defaultSlots: patch.work.defaultSlots.map((slot) => ({
              start: this.normalizeTime(slot.start).slice(0, 5),
              end: this.normalizeTime(slot.end).slice(0, 5)
            }))
          }
        : patch.work
    };

    const config = patchRuntimeConfig(normalizedPatch);

    if (isDbConfigured(config)) {
      try {
        await this.ensureDatabaseSchema(config.db);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(`数据库初始化失败: ${message}`);
      }
    }

    return {
      ...config,
      configDir: getWorktimeHomeDir(),
      configPath: getRuntimeConfigPath()
    };
  }

  private normalizeTime(value: string): string {
    const [hour, minute, second = "00"] = value.split(":");
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  }

  private timeToSeconds(value: string): number {
    const [hour, minute, second] = value.split(":").map(Number);
    return hour * 3600 + minute * 60 + second;
  }

  @Get("status")
  async getStatus() {
    const config = ensureRuntimeConfigFile();
    const dbConfigured = isDbConfigured(config);
    const aiConfigured = isAiConfigured(config);
    const dbConnected = dbConfigured ? await this.testDbConnection(config.db).catch(() => false) : false;

    return {
      dbConfigured,
      aiConfigured,
      dbConnected,
      mcpEnabled: Boolean(config.mcp.enabled),
      configDir: getWorktimeHomeDir(),
      configPath: getRuntimeConfigPath()
    };
  }

  private async testDbConnection(db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  }): Promise<boolean> {
    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
        host: db.host,
        port: Number(db.port),
        user: db.user,
        password: db.password,
        database: db.name
      });
      await connection.ping();
      return true;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  private async ensureDatabaseSchema(db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  }): Promise<void> {
    const dbName = db.name.trim();
    if (!dbName) {
      throw new Error("数据库名不能为空");
    }

    const escapedDbName = `\`${dbName.replace(/`/g, "``")}\``;
    const tableNames = ["work_daily_record", "work_record_item", "work_time_slot"];

    let adminConnection: mysql.Connection | null = null;
    let databaseConnection: mysql.Connection | null = null;

    try {
      adminConnection = await mysql.createConnection({
        host: db.host,
        port: Number(db.port),
        user: db.user,
        password: db.password
      });

      await adminConnection.query(
        `CREATE DATABASE IF NOT EXISTS ${escapedDbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      const [rows] = await adminConnection.query<Array<{ table_name: string } & mysql.RowDataPacket>>(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ?
            AND table_name IN (?, ?, ?)
        `,
        [dbName, tableNames[0], tableNames[1], tableNames[2]]
      );

      if (rows.length === tableNames.length) {
        return;
      }

      databaseConnection = await mysql.createConnection({
        host: db.host,
        port: Number(db.port),
        user: db.user,
        password: db.password,
        database: dbName,
        multipleStatements: true
      });

      const sqlPath = join(__dirname, "../../sql/worktime.sql");
      const rawSql = readFileSync(sqlPath, "utf-8");
      const normalizedSql = rawSql.replace(/CREATE TABLE\\s+/gi, "CREATE TABLE IF NOT EXISTS ");

      await databaseConnection.query(normalizedSql);
    } finally {
      if (databaseConnection) {
        await databaseConnection.end();
      }
      if (adminConnection) {
        await adminConnection.end();
      }
    }
  }
}
