import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type Pool as PgPool } from "pg";
import { isPastIssueDate, type Opportunity } from "./opportunities";

export type StoredDay = {
  date: string;
  rows: Opportunity[];
  total: number;
  pages: number;
  fetchedAt: string;
  source: string;
};

const globalDb = globalThis as unknown as {
  rfqDb?: DatabaseSync;
  rfqPg?: PgPool;
  rfqPgReady?: Promise<void>;
};

function usePostgres() {
  return Boolean(process.env.DATABASE_URL);
}

function sqlite() {
  if (!globalDb.rfqDb) {
    const file =
      process.env.RFQ_DB_PATH || join(process.cwd(), "data", "rfqs.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec(`
      CREATE TABLE IF NOT EXISTS days (
        issue_date TEXT PRIMARY KEY,
        total INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        source TEXT NOT NULL,
        rows_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS issue_dates (
        issue_date TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      );
    `);
    globalDb.rfqDb = db;
  }
  return globalDb.rfqDb;
}

function postgres() {
  if (!globalDb.rfqPg) {
    globalDb.rfqPg = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalDb.rfqPg;
}

async function ready() {
  if (!usePostgres()) return;
  if (!globalDb.rfqPgReady) {
    globalDb.rfqPgReady = postgres().query(`
      CREATE TABLE IF NOT EXISTS days (
        issue_date TEXT PRIMARY KEY,
        total INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        source TEXT NOT NULL,
        rows_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS issue_dates (
        issue_date TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      );
    `).then(() => undefined);
  }
  await globalDb.rfqPgReady;
}

function cleanDates(dates: string[]) {
  return [
    ...new Set(dates.filter((date) => /^\d{2}-\d{2}-\d{4}$/.test(date))),
  ];
}

export async function saveDates(dates: string[]) {
  const clean = cleanDates(dates);
  if (!clean.length) return;
  if (!usePostgres()) {
    const db = sqlite();
    const insert = db.prepare(
      "INSERT INTO issue_dates (issue_date, position) VALUES (?, ?)",
    );
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM issue_dates");
      clean.forEach((date, index) => insert.run(date, index));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return;
  }
  await ready();
  const client = await postgres().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM issue_dates");
    for (const [index, date] of clean.entries()) {
      await client.query(
        "INSERT INTO issue_dates (issue_date, position) VALUES ($1, $2)",
        [date, index],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadDates() {
  if (!usePostgres()) {
    return sqlite()
      .prepare("SELECT issue_date FROM issue_dates ORDER BY position")
      .all()
      .map((row) => String(row.issue_date));
  }
  await ready();
  const result = await postgres().query(
    "SELECT issue_date FROM issue_dates ORDER BY position",
  );
  return result.rows.map((row) => String(row.issue_date));
}

export async function saveDay(day: StoredDay) {
  const rowsJson = JSON.stringify(day.rows);
  if (!usePostgres()) {
    sqlite()
      .prepare(
        `INSERT INTO days (issue_date, total, pages, fetched_at, source, rows_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(issue_date) DO UPDATE SET
           total = excluded.total,
           pages = excluded.pages,
           fetched_at = excluded.fetched_at,
           source = excluded.source,
           rows_json = excluded.rows_json`,
      )
      .run(
        day.date,
        day.total,
        day.pages,
        day.fetchedAt,
        day.source,
        rowsJson,
      );
    return;
  }
  await ready();
  await postgres().query(
    `INSERT INTO days (issue_date, total, pages, fetched_at, source, rows_json)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (issue_date) DO UPDATE SET
       total = EXCLUDED.total,
       pages = EXCLUDED.pages,
       fetched_at = EXCLUDED.fetched_at,
       source = EXCLUDED.source,
       rows_json = EXCLUDED.rows_json`,
    [day.date, day.total, day.pages, day.fetchedAt, day.source, rowsJson],
  );
}

export async function loadDay(date: string): Promise<StoredDay | null> {
  if (!usePostgres()) {
    const row = sqlite()
      .prepare(
        "SELECT issue_date, total, pages, fetched_at, source, rows_json FROM days WHERE issue_date = ?",
      )
      .get(date) as
      | {
          issue_date: string;
          total: number;
          pages: number;
          fetched_at: string;
          source: string;
          rows_json: string;
        }
      | undefined;
    if (!row) return null;
    return rowToDay(row);
  }
  await ready();
  const result = await postgres().query(
    "SELECT issue_date, total, pages, fetched_at, source, rows_json FROM days WHERE issue_date = $1",
    [date],
  );
  const row = result.rows[0];
  if (!row) return null;
  return rowToDay(row);
}

function rowToDay(row: {
  issue_date: string;
  total: number;
  pages: number;
  fetched_at: string;
  source: string;
  rows_json: string;
}): StoredDay {
  const rows = JSON.parse(String(row.rows_json)) as Opportunity[];
  return {
    date: String(row.issue_date),
    rows: Array.isArray(rows) ? rows : [],
    total: Number(row.total),
    pages: Number(row.pages),
    fetchedAt: String(row.fetched_at),
    source: String(row.source),
  };
}

export async function savedPastDay(
  date: string,
  today?: string,
): Promise<StoredDay | null> {
  if (!isPastIssueDate(date, today)) return null;
  const day = await loadDay(date);
  if (!day || day.total < 1 || day.rows.length < day.total) return null;
  return day;
}
