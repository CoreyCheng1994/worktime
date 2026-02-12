import { Injectable } from "@nestjs/common";
import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { isDbConfigured, loadRuntimeConfig } from "../system/runtime-config";
import { DailyRecord, RecordItem, WorkSlot } from "./work.types";
import { WorkRepository } from "./work.repository";

interface RecordRow extends RowDataPacket {
  id: number | string;
  work_date: string;
  created_time: string;
  updated_time: string;
}

interface ItemRow extends RowDataPacket {
  id: number | string;
  record_id: number | string;
  item_type: number;
  status: number;
  text_value: string | null;
  ref_uid: number | string | null;
  progress_start: number | null;
  progress_end: number | null;
  sort: number;
  created_time: string;
  updated_time: string;
}

interface SlotRow extends RowDataPacket {
  id: number | string;
  work_date: string;
  start_time: string;
  end_time: string;
  sort: number;
  created_time: string;
  updated_time: string;
}

@Injectable()
export class MySqlWorkRepository implements WorkRepository {
  private pool: Pool | null = null;
  private poolFingerprint = "";

  async getSlotsByDate(date: string): Promise<WorkSlot[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query<SlotRow[]>(
      "SELECT * FROM work_time_slot WHERE work_date = ? ORDER BY sort ASC, id ASC",
      [date]
    );
    return rows.map(this.mapSlotRow);
  }

  async getSlotsByDateRange(startDate: string, endDate: string): Promise<WorkSlot[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query<SlotRow[]>(
      "SELECT * FROM work_time_slot WHERE work_date BETWEEN ? AND ? ORDER BY work_date ASC, sort ASC, id ASC",
      [startDate, endDate]
    );
    return rows.map(this.mapSlotRow);
  }

  async replaceSlots(date: string, slots: WorkSlot[]): Promise<void> {
    await this.withTransaction(async (connection) => {
      await connection.query("DELETE FROM work_time_slot WHERE work_date = ?", [date]);
      if (slots.length === 0) {
        return;
      }
      const values = slots.map((slot) => [
        date,
        slot.start_time,
        slot.end_time,
        slot.sort,
        slot.created_time,
        slot.updated_time
      ]);
      await connection.query(
        "INSERT INTO work_time_slot (work_date, start_time, end_time, sort, created_time, updated_time) VALUES ?",
        [values]
      );
    });
  }

  async findRecordByDate(date: string): Promise<DailyRecord | null> {
    const pool = await this.getPool();
    const [rows] = await pool.query<RecordRow[]>(
      "SELECT * FROM work_daily_record WHERE work_date = ? LIMIT 1",
      [date]
    );
    if (rows.length === 0) {
      return null;
    }
    const record = this.mapRecordRow(rows[0]);
    return { ...record, items: [] };
  }

  async findRecordById(recordId: number): Promise<DailyRecord | null> {
    const pool = await this.getPool();
    const [rows] = await pool.query<RecordRow[]>(
      "SELECT * FROM work_daily_record WHERE id = ? LIMIT 1",
      [recordId]
    );
    if (rows.length === 0) {
      return null;
    }
    const record = this.mapRecordRow(rows[0]);
    return { ...record, items: [] };
  }

  async createRecord(date: string, now: string): Promise<DailyRecord> {
    const pool = await this.getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO work_daily_record (work_date, created_time, updated_time) VALUES (?, ?, ?)",
      [date, now, now]
    );
    return {
      id: Number(result.insertId),
      work_date: date,
      created_time: now,
      updated_time: now,
      items: []
    };
  }

  async updateRecordUpdatedTime(recordId: number, updatedTime: string): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE work_daily_record SET updated_time = ? WHERE id = ?",
      [updatedTime, recordId]
    );
  }

  async getRecordsByDateRange(startDate: string, endDate: string): Promise<DailyRecord[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query<RecordRow[]>(
      "SELECT * FROM work_daily_record WHERE work_date BETWEEN ? AND ? ORDER BY work_date ASC, id ASC",
      [startDate, endDate]
    );
    return rows.map((row) => ({ ...this.mapRecordRow(row), items: [] }));
  }

  async getItemsByRecordId(recordId: number): Promise<RecordItem[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query<ItemRow[]>(
      "SELECT * FROM work_record_item WHERE record_id = ? ORDER BY sort ASC, id ASC",
      [recordId]
    );
    return rows.map(this.mapItemRow);
  }

  async getItemsByRecordIds(recordIds: number[]): Promise<RecordItem[]> {
    if (recordIds.length === 0) {
      return [];
    }
    const pool = await this.getPool();
    const [rows] = await pool.query<ItemRow[]>(
      "SELECT * FROM work_record_item WHERE record_id IN (?) ORDER BY record_id ASC, sort ASC, id ASC",
      [recordIds]
    );
    return rows.map(this.mapItemRow);
  }

  async getNextItemSort(recordId: number): Promise<number> {
    const pool = await this.getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT MAX(sort) AS maxSort FROM work_record_item WHERE record_id = ?",
      [recordId]
    );
    const maxSort = rows[0]?.maxSort;
    if (maxSort === null || maxSort === undefined) {
      return 0;
    }
    return Number(maxSort) + 1;
  }

  async insertItem(recordId: number, item: RecordItem): Promise<RecordItem> {
    const pool = await this.getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO work_record_item (record_id, item_type, status, text_value, ref_uid, progress_start, progress_end, sort, created_time, updated_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        recordId,
        item.item_type,
        item.status,
        item.text_value,
        item.ref_uid,
        item.progress_start,
        item.progress_end,
        item.sort,
        item.created_time,
        item.updated_time
      ]
    );

    return { ...item, id: Number(result.insertId) };
  }

  async findItemById(itemId: number): Promise<RecordItem | null> {
    const pool = await this.getPool();
    const [rows] = await pool.query<ItemRow[]>(
      "SELECT * FROM work_record_item WHERE id = ? LIMIT 1",
      [itemId]
    );
    if (rows.length === 0) {
      return null;
    }
    return this.mapItemRow(rows[0]);
  }

  async updateItem(item: RecordItem): Promise<void> {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE work_record_item SET status = ?, text_value = ?, ref_uid = ?, progress_start = ?, progress_end = ?, sort = ?, updated_time = ? WHERE id = ?",
      [
        item.status,
        item.text_value,
        item.ref_uid,
        item.progress_start,
        item.progress_end,
        item.sort,
        item.updated_time,
        item.id
      ]
    );
  }

  async deleteItem(itemId: number): Promise<void> {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM work_record_item WHERE id = ?", [itemId]);
  }

  private mapRecordRow = (row: RecordRow): DailyRecord => {
    return {
      id: Number(row.id),
      work_date: row.work_date,
      created_time: row.created_time,
      updated_time: row.updated_time,
      items: []
    };
  };

  private mapItemRow = (row: ItemRow): RecordItem => {
    return {
      id: Number(row.id),
      record_id: Number(row.record_id),
      item_type: Number(row.item_type) as 0 | 1,
      status: Number(row.status) as 0 | 1 | 2,
      text_value: row.text_value,
      ref_uid: row.ref_uid === null ? null : Number(row.ref_uid),
      progress_start: row.progress_start === null ? null : Number(row.progress_start),
      progress_end: row.progress_end === null ? null : Number(row.progress_end),
      sort: Number(row.sort),
      created_time: row.created_time,
      updated_time: row.updated_time
    };
  };

  private mapSlotRow = (row: SlotRow): WorkSlot => {
    return {
      id: Number(row.id),
      work_date: row.work_date,
      start_time: row.start_time,
      end_time: row.end_time,
      sort: Number(row.sort),
      created_time: row.created_time,
      updated_time: row.updated_time
    };
  };

  private async withTransaction(task: (connection: PoolConnection) => Promise<void>) {
    const pool = await this.getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await task(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async getPool(): Promise<Pool> {
    const config = loadRuntimeConfig();
    if (!isDbConfigured(config)) {
      throw new Error("数据库配置不完整，请在设置页填写 MySQL 配置");
    }

    const fingerprint = [
      config.db.host,
      config.db.port,
      config.db.user,
      config.db.password,
      config.db.name
    ].join("|");

    if (this.pool && this.poolFingerprint === fingerprint) {
      return this.pool;
    }

    if (this.pool) {
      await this.pool.end();
    }

    this.pool = mysql.createPool({
      host: config.db.host,
      port: Number(config.db.port),
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      connectionLimit: 10,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true
    });
    this.poolFingerprint = fingerprint;
    return this.pool;
  }
}
