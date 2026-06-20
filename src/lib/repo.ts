import { db } from "./db";
import type {
  Chapter,
  Character,
  PlotPoint,
  TimelineEvent,
  Work,
  WorldSetting,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// 분량 계산: 공백 제외 글자 수 (웹소설 원고 분량 기준, 기획안 §2-4)
// 스프레드로 세어 이모지/한자 보조 평면 문자도 1자로 처리.
// ─────────────────────────────────────────────────────────────────────────
export function countChars(text: string): number {
  return [...text.replace(/\s/g, "")].length;
}

function now(): string {
  return new Date()
    .toLocaleString("sv-SE", { hour12: false })
    .replace("T", " ");
}

// ───────────────────────────── Works ────────────────────────────────────

export function listWorks(): Work[] {
  return db
    .prepare("SELECT * FROM works ORDER BY updated_at DESC")
    .all() as Work[];
}

export function getWork(id: number): Work | undefined {
  return db.prepare("SELECT * FROM works WHERE id = ?").get(id) as
    | Work
    | undefined;
}

export function createWork(input: Partial<Work>): Work {
  const info = db
    .prepare(
      `INSERT INTO works (title, genre, tone, default_length, synopsis, persistent_conditions)
       VALUES (@title, @genre, @tone, @default_length, @synopsis, @persistent_conditions)`,
    )
    .run({
      title: input.title?.trim() || "제목 없는 작품",
      genre: input.genre ?? "",
      tone: input.tone ?? "",
      default_length: input.default_length ?? 2000,
      synopsis: input.synopsis ?? "",
      persistent_conditions: input.persistent_conditions ?? "",
    });
  return getWork(Number(info.lastInsertRowid))!;
}

export function updateWork(id: number, input: Partial<Work>): Work | undefined {
  const existing = getWork(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input, id };
  db.prepare(
    `UPDATE works SET title=@title, genre=@genre, tone=@tone,
       default_length=@default_length, synopsis=@synopsis,
       persistent_conditions=@persistent_conditions, updated_at=@updated_at
     WHERE id=@id`,
  ).run({ ...merged, updated_at: now() });
  return getWork(id);
}

export function touchWork(id: number): void {
  db.prepare("UPDATE works SET updated_at=? WHERE id=?").run(now(), id);
}

export function deleteWork(id: number): void {
  db.prepare("DELETE FROM works WHERE id = ?").run(id);
}

// ─────────────────────────── Characters ──────────────────────────────────

export function listCharacters(workId: number): Character[] {
  return db
    .prepare("SELECT * FROM characters WHERE work_id = ? ORDER BY id ASC")
    .all(workId) as Character[];
}

export function getCharacter(id: number): Character | undefined {
  return db.prepare("SELECT * FROM characters WHERE id = ?").get(id) as
    | Character
    | undefined;
}

export function createCharacter(
  workId: number,
  input: Partial<Character>,
): Character {
  const info = db
    .prepare(
      `INSERT INTO characters
        (work_id, name, appearance, personality, speech_style, goal, relationships, secrets, notes)
       VALUES (@work_id, @name, @appearance, @personality, @speech_style, @goal, @relationships, @secrets, @notes)`,
    )
    .run({
      work_id: workId,
      name: input.name?.trim() || "이름 없는 인물",
      appearance: input.appearance ?? "",
      personality: input.personality ?? "",
      speech_style: input.speech_style ?? "",
      goal: input.goal ?? "",
      relationships: input.relationships ?? "",
      secrets: input.secrets ?? "",
      notes: input.notes ?? "",
    });
  touchWork(workId);
  return getCharacter(Number(info.lastInsertRowid))!;
}

export function updateCharacter(
  id: number,
  input: Partial<Character>,
): Character | undefined {
  const existing = getCharacter(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input, id };
  db.prepare(
    `UPDATE characters SET name=@name, appearance=@appearance, personality=@personality,
       speech_style=@speech_style, goal=@goal, relationships=@relationships,
       secrets=@secrets, notes=@notes
     WHERE id=@id`,
  ).run(merged);
  touchWork(existing.work_id);
  return getCharacter(id);
}

export function deleteCharacter(id: number): void {
  const existing = getCharacter(id);
  db.prepare("DELETE FROM characters WHERE id = ?").run(id);
  if (existing) touchWork(existing.work_id);
}

// ───────────────────────── World settings ────────────────────────────────

export function listWorldSettings(workId: number): WorldSetting[] {
  return db
    .prepare(
      "SELECT * FROM world_settings WHERE work_id = ? ORDER BY category, id ASC",
    )
    .all(workId) as WorldSetting[];
}

export function getWorldSetting(id: number): WorldSetting | undefined {
  return db.prepare("SELECT * FROM world_settings WHERE id = ?").get(id) as
    | WorldSetting
    | undefined;
}

export function createWorldSetting(
  workId: number,
  input: Partial<WorldSetting>,
): WorldSetting {
  const info = db
    .prepare(
      `INSERT INTO world_settings (work_id, category, title, content)
       VALUES (@work_id, @category, @title, @content)`,
    )
    .run({
      work_id: workId,
      category: input.category ?? "용어",
      title: input.title?.trim() || "제목 없는 항목",
      content: input.content ?? "",
    });
  touchWork(workId);
  return getWorldSetting(Number(info.lastInsertRowid))!;
}

export function updateWorldSetting(
  id: number,
  input: Partial<WorldSetting>,
): WorldSetting | undefined {
  const existing = getWorldSetting(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input, id };
  db.prepare(
    `UPDATE world_settings SET category=@category, title=@title, content=@content WHERE id=@id`,
  ).run(merged);
  touchWork(existing.work_id);
  return getWorldSetting(id);
}

export function deleteWorldSetting(id: number): void {
  const existing = getWorldSetting(id);
  db.prepare("DELETE FROM world_settings WHERE id = ?").run(id);
  if (existing) touchWork(existing.work_id);
}

// ─────────────────────────── Plot points ─────────────────────────────────

export function listPlotPoints(workId: number): PlotPoint[] {
  return db
    .prepare(
      "SELECT * FROM plot_points WHERE work_id = ? ORDER BY order_index ASC, id ASC",
    )
    .all(workId) as PlotPoint[];
}

export function getPlotPoint(id: number): PlotPoint | undefined {
  return db.prepare("SELECT * FROM plot_points WHERE id = ?").get(id) as
    | PlotPoint
    | undefined;
}

export function createPlotPoint(
  workId: number,
  input: Partial<PlotPoint>,
): PlotPoint {
  const maxOrder = db
    .prepare(
      "SELECT COALESCE(MAX(order_index), -1) AS m FROM plot_points WHERE work_id = ?",
    )
    .get(workId) as { m: number };
  const info = db
    .prepare(
      `INSERT INTO plot_points (work_id, order_index, title, description, target_chapter)
       VALUES (@work_id, @order_index, @title, @description, @target_chapter)`,
    )
    .run({
      work_id: workId,
      order_index: input.order_index ?? maxOrder.m + 1,
      title: input.title?.trim() || "제목 없는 비트",
      description: input.description ?? "",
      target_chapter: input.target_chapter ?? null,
    });
  touchWork(workId);
  return getPlotPoint(Number(info.lastInsertRowid))!;
}

export function updatePlotPoint(
  id: number,
  input: Partial<PlotPoint>,
): PlotPoint | undefined {
  const existing = getPlotPoint(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input, id };
  db.prepare(
    `UPDATE plot_points SET order_index=@order_index, title=@title,
       description=@description, target_chapter=@target_chapter WHERE id=@id`,
  ).run(merged);
  touchWork(existing.work_id);
  return getPlotPoint(id);
}

export function deletePlotPoint(id: number): void {
  const existing = getPlotPoint(id);
  db.prepare("DELETE FROM plot_points WHERE id = ?").run(id);
  if (existing) touchWork(existing.work_id);
}

// ───────────────────────────── Chapters ──────────────────────────────────

export function listChapters(workId: number): Chapter[] {
  return db
    .prepare("SELECT * FROM chapters WHERE work_id = ? ORDER BY number ASC")
    .all(workId) as Chapter[];
}

export function getChapter(id: number): Chapter | undefined {
  return db.prepare("SELECT * FROM chapters WHERE id = ?").get(id) as
    | Chapter
    | undefined;
}

export function nextChapterNumber(workId: number): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(number), 0) AS m FROM chapters WHERE work_id = ?",
    )
    .get(workId) as { m: number };
  return row.m + 1;
}

/** 직전 회차 (현재 회차보다 작은 number 중 가장 큰 것) — 컨텍스트 주입용 (기획안 §6) */
export function getPreviousChapter(
  workId: number,
  number: number,
): Chapter | undefined {
  return db
    .prepare(
      "SELECT * FROM chapters WHERE work_id = ? AND number < ? ORDER BY number DESC LIMIT 1",
    )
    .get(workId, number) as Chapter | undefined;
}

export function createChapter(
  workId: number,
  input: Partial<Chapter>,
): Chapter {
  const number = input.number ?? nextChapterNumber(workId);
  const body = input.body ?? "";
  const info = db
    .prepare(
      `INSERT INTO chapters (work_id, number, title, body, status, word_count, summary, beat)
       VALUES (@work_id, @number, @title, @body, @status, @word_count, @summary, @beat)`,
    )
    .run({
      work_id: workId,
      number,
      title: input.title ?? "",
      body,
      status: input.status ?? "초고",
      word_count: countChars(body),
      summary: input.summary ?? "",
      beat: input.beat ?? "",
    });
  touchWork(workId);
  return getChapter(Number(info.lastInsertRowid))!;
}

export function updateChapter(
  id: number,
  input: Partial<Chapter>,
): Chapter | undefined {
  const existing = getChapter(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...input, id };
  merged.word_count = countChars(merged.body ?? "");
  db.prepare(
    `UPDATE chapters SET number=@number, title=@title, body=@body, status=@status,
       word_count=@word_count, summary=@summary, beat=@beat, updated_at=@updated_at
     WHERE id=@id`,
  ).run({ ...merged, updated_at: now() });
  touchWork(existing.work_id);
  return getChapter(id);
}

export function deleteChapter(id: number): void {
  const existing = getChapter(id);
  db.prepare("DELETE FROM chapters WHERE id = ?").run(id);
  if (existing) touchWork(existing.work_id);
}

export interface ChapterStats {
  total: number;
  done: number;
  words: number;
}

/** 작품별 회차 통계 — 대시보드/연재 관리용 (기획안 §3) */
export function chapterStats(workId: number): ChapterStats {
  return db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status='완료' THEN 1 ELSE 0 END), 0) AS done,
              COALESCE(SUM(word_count), 0) AS words
       FROM chapters WHERE work_id = ?`,
    )
    .get(workId) as ChapterStats;
}

// ──────────────────────────── Timeline ───────────────────────────────────

export function listTimeline(workId: number): TimelineEvent[] {
  return db
    .prepare(
      "SELECT * FROM timeline_events WHERE work_id = ? ORDER BY id ASC",
    )
    .all(workId) as TimelineEvent[];
}

export function createTimelineEvent(
  workId: number,
  input: Partial<TimelineEvent>,
): TimelineEvent {
  const info = db
    .prepare(
      `INSERT INTO timeline_events (work_id, chapter_id, description, involved_characters)
       VALUES (@work_id, @chapter_id, @description, @involved_characters)`,
    )
    .run({
      work_id: workId,
      chapter_id: input.chapter_id ?? null,
      description: input.description?.trim() || "",
      involved_characters: input.involved_characters ?? "",
    });
  touchWork(workId);
  return db
    .prepare("SELECT * FROM timeline_events WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as TimelineEvent;
}

export function deleteTimelineEvent(id: number): void {
  db.prepare("DELETE FROM timeline_events WHERE id = ?").run(id);
}
