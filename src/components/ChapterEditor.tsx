"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  CHAPTER_STATUSES,
  type Chapter,
  type Character,
  type ChapterStatus,
  type WorldSetting,
} from "@/lib/types";

function countChars(text: string): number {
  return [...text.replace(/\s/g, "")].length;
}

type GenMode = "auto" | "continue" | "regenerate";

interface EditorWork {
  id: number;
  title: string;
  genre: string;
  tone: string;
  default_length: number;
  persistent_conditions: string;
}

export default function ChapterEditor({
  work,
  chapter,
  characters,
  worldSettings,
  prevChapter,
}: {
  work: EditorWork;
  chapter: Chapter;
  characters: Character[];
  worldSettings: WorldSetting[];
  prevChapter: { number: number; summary: string } | null;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [beat, setBeat] = useState(chapter.beat);
  const [body, setBody] = useState(chapter.body);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [summary, setSummary] = useState(chapter.summary);
  const [persistent, setPersistent] = useState(work.persistent_conditions);

  const [baseline, setBaseline] = useState({
    title: chapter.title,
    beat: chapter.beat,
    body: chapter.body,
    status: chapter.status,
  });

  const [condition, setCondition] = useState("");
  const [conditionMode, setConditionMode] = useState<"once" | "persistent">(
    "once",
  );

  const [busy, setBusy] = useState<null | GenMode | "save" | "summarize">(null);
  const [error, setError] = useState<string | null>(null);
  const [tlSuggestions, setTlSuggestions] = useState<
    { description: string; involved_characters: string }[]
  >([]);

  const dirty =
    title !== baseline.title ||
    beat !== baseline.beat ||
    body !== baseline.body ||
    status !== baseline.status;

  const chars = useMemo(() => countChars(body), [body]);
  const pct = work.default_length
    ? Math.min(100, Math.round((chars / work.default_length) * 100))
    : 0;

  const save = useCallback(async () => {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, beat, body, status }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setBaseline({ title, beat, body, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }, [chapter.id, title, beat, body, status]);

  async function generate(mode: GenMode) {
    setBusy(mode);
    setError(null);
    try {
      // 지속 조건이면 먼저 작품 설정에 저장
      let onceCondition = condition.trim();
      if (onceCondition && conditionMode === "persistent") {
        const merged = (persistent + "\n" + onceCondition).trim();
        await fetch(`/api/works/${work.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persistent_conditions: merged }),
        });
        setPersistent(merged);
        setCondition("");
        onceCondition = ""; // 이미 지속 조건에 포함됨
      }

      const res = await fetch(`/api/chapters/${chapter.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          condition: conditionMode === "once" ? onceCondition : "",
          currentBody: body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "집필 실패");

      if (mode === "continue") {
        setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${data.text.trim()}` : data.text.trim()));
      } else {
        setBody(data.text.trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function summarize() {
    setBusy("summarize");
    setError(null);
    try {
      const res = await fetch(`/api/chapters/${chapter.id}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentBody: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요약 실패");
      setSummary(data.summary || "");
      setTlSuggestions(data.timeline_suggestions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function addTimeline(
    item: { description: string; involved_characters: string },
    idx: number,
  ) {
    await fetch(`/api/works/${work.id}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, chapter_id: chapter.id }),
    });
    setTlSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  const generating = busy === "auto" || busy === "continue" || busy === "regenerate";

  return (
    <div>
      {/* 상단 바 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/works/${work.id}/chapters`}
          className="text-xs text-ink-400 hover:text-ink-200"
        >
          ← 회차 목록
        </Link>
        <span className="font-serif text-lg font-semibold text-ink-300">
          {chapter.number}화
        </span>
        <input
          className="flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 font-serif text-base focus:border-amber-500 focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="회차 제목"
        />
        <select
          className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as ChapterStatus)}
        >
          {CHAPTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={save} disabled={busy !== null || !dirty}>
          {busy === "save" ? "저장 중…" : dirty ? "저장*" : "저장됨"}
        </button>
      </div>

      {/* 목표 사건(beat) */}
      <div className="mb-3">
        <label className="field-label">이번 회차 목표 사건 (beat)</label>
        <input
          className="field-input"
          value={beat}
          onChange={(e) => setBeat(e.target.value)}
          placeholder="예) 주인공과 악역이 처음 만나 충돌한다"
        />
      </div>

      {/* 조건 입력 (§2-3-A) */}
      <div className="card mb-3">
        <label className="field-label">조건 입력 (자연어)</label>
        <textarea
          className="field-input resize-y"
          rows={2}
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder='예) "1인칭 시점, 어두운 분위기로" / "마지막은 절벽 클리프행어로 끝내줘"'
        />
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={conditionMode === "once"}
              onChange={() => setConditionMode("once")}
            />
            일회성 (이번 생성만)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={conditionMode === "persistent"}
              onChange={() => setConditionMode("persistent")}
            />
            지속 (작품 전체 가이드로 저장)
          </label>
        </div>
      </div>

      {/* AI 버튼 */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => generate("auto")} disabled={busy !== null}>
          {busy === "auto" ? "집필 중…" : "✨ 자동 생성"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => generate("continue")}
          disabled={busy !== null}
        >
          {busy === "continue" ? "이어쓰는 중…" : "➕ 이어쓰기"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => generate("regenerate")}
          disabled={busy !== null}
        >
          {busy === "regenerate" ? "재생성 중…" : "🔄 재생성"}
        </button>
        <span className="flex-1" />
        <button className="btn-ghost" onClick={summarize} disabled={busy !== null}>
          {busy === "summarize" ? "요약 중…" : "📝 요약·사건 갱신"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 본문 + 컨텍스트 패널 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <textarea
            className={`prose-novel min-h-[60vh] w-full resize-y rounded-lg border border-ink-800 bg-ink-900 p-4 focus:border-amber-500/60 focus:outline-none ${generating ? "opacity-60" : ""}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="여기에 본문이 표시됩니다. 직접 쓰거나 ‘자동 생성’으로 시작하세요."
            disabled={generating}
          />
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs text-ink-400">
              {chars.toLocaleString()} / {work.default_length.toLocaleString()}자 ({pct}%)
            </span>
          </div>
        </div>

        {/* 컨텍스트 패널 — 이 회차에 주입되는 정보 */}
        <aside className="space-y-3 text-sm">
          <div className="card">
            <p className="field-label">주입 컨텍스트</p>
            <p className="text-xs text-ink-400">
              아래 정보가 AI 집필 시 제약 조건으로 함께 전달됩니다.
            </p>
          </div>

          <details className="card" open>
            <summary className="cursor-pointer text-xs font-semibold text-ink-300">
              작품 가이드
            </summary>
            <div className="mt-2 space-y-1 text-xs text-ink-400">
              <p>장르: {work.genre || "-"}</p>
              <p>톤/문체: {work.tone || "-"}</p>
              <p>지속 조건: {persistent || "없음"}</p>
            </div>
          </details>

          <details className="card">
            <summary className="cursor-pointer text-xs font-semibold text-ink-300">
              등장인물 ({characters.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-400">
              {characters.map((c) => (
                <li key={c.id}>• {c.name}</li>
              ))}
              {characters.length === 0 && <li>등록된 인물 없음</li>}
            </ul>
          </details>

          <details className="card">
            <summary className="cursor-pointer text-xs font-semibold text-ink-300">
              세계관 설정 ({worldSettings.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-400">
              {worldSettings.map((w) => (
                <li key={w.id}>
                  • [{w.category}] {w.title}
                </li>
              ))}
              {worldSettings.length === 0 && <li>등록된 설정 없음</li>}
            </ul>
          </details>

          {prevChapter?.summary && (
            <div className="card">
              <p className="field-label">직전 {prevChapter.number}화 요약</p>
              <p className="text-xs text-ink-400">{prevChapter.summary}</p>
            </div>
          )}

          <div className="card">
            <p className="field-label">이 회차 요약</p>
            <p className="text-xs text-ink-400">
              {summary || "‘요약·사건 갱신’으로 생성 (다음 회차 컨텍스트로 사용)"}
            </p>
          </div>

          {tlSuggestions.length > 0 && (
            <div className="card border-amber-500/40">
              <p className="field-label text-amber-300">새 사건 기록 제안</p>
              <ul className="space-y-2">
                {tlSuggestions.map((t, i) => (
                  <li key={i} className="text-xs text-ink-300">
                    <p>{t.description}</p>
                    {t.involved_characters && (
                      <p className="text-ink-500">관련: {t.involved_characters}</p>
                    )}
                    <button
                      className="btn-secondary mt-1 !px-2 !py-0.5 text-xs"
                      onClick={() => addTimeline(t, i)}
                    >
                      타임라인에 추가
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
