import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────
// SQLite 연결 (단일 사용자 로컬 전제, 기획안 §4).
// Next.js dev 의 hot-reload 에서 연결이 중복 생성되지 않도록 globalThis 에 캐싱.
// ─────────────────────────────────────────────────────────────────────────

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "webnovel.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  default_length INTEGER NOT NULL DEFAULT 2000,
  synopsis TEXT NOT NULL DEFAULT '',
  persistent_conditions TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  appearance TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  speech_style TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  relationships TEXT NOT NULL DEFAULT '',
  secrets TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS world_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '용어',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS plot_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_chapter INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '초고',
  word_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  beat TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  involved_characters TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_characters_work ON characters(work_id);
CREATE INDEX IF NOT EXISTS idx_world_work ON world_settings(work_id);
CREATE INDEX IF NOT EXISTS idx_plot_work ON plot_points(work_id);
CREATE INDEX IF NOT EXISTS idx_chapters_work ON chapters(work_id);
CREATE INDEX IF NOT EXISTS idx_timeline_work ON timeline_events(work_id);
`;

function createConnection(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const globalForDb = globalThis as unknown as {
  __webnovelDb?: Database.Database;
};

export const db: Database.Database =
  globalForDb.__webnovelDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__webnovelDb = db;
}
