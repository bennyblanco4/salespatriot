import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isPastIssueDate, type Opportunity } from "./opportunities";

export type StoredDay = {
  date: string;
  rows: Opportunity[];
  total: number;
  pages: number;
  fetchedAt: string;
  source: string;
};

const globalDb = globalThis as unknown as { rfqDb?: DatabaseSync };

function database() {
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

export function saveDates(dates: string[]) {
  const clean = [
    ...new Set(dates.filter((date) => /^\d{2}-\d{2}-\d{4}$/.test(date))),
  ];
  if (!clean.length) return;
  const db = database();
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
}

export function loadDates() {
  return database()
    .prepare("SELECT issue_date FROM issue_dates ORDER BY position")
    .all()
    .map((row) => String(row.issue_date));
}

export function saveDay(day: StoredDay) {
  database()
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
      JSON.stringify(day.rows),
    );
}

export function savedPastDay(date: string, today?: string): StoredDay | null {
  if (!isPastIssueDate(date, today)) return null;
  const day = loadDay(date);
  if (!day || day.total < 1 || day.rows.length < day.total) return null;
  return day;
}

export function loadDay(date: string): StoredDay | null {
  const row = database()
    .prepare(
      "SELECT issue_date, total, pages, fetched_at, source, rows_json FROM days WHERE issue_date = ?",
    )
    .get(date);
  if (!row) return null;
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
