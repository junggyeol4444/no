"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

// 첫 글자가 이 시간 안에 안 오면 "멈춘 것"으로 보고 중단하고 안내한다.
// (로컬 모델은 처음 켤 때 로딩+첫 토큰까지 오래 걸리므로 넉넉하게)
// 느린 PC라면 .env.local 의 NEXT_PUBLIC_FIRST_BYTE_TIMEOUT_MS 로 늘릴 수 있다.
const FIRST_BYTE_TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_FIRST_BYTE_TIMEOUT_MS) || 180_000;
// 이 시간이 지나도 첫 글자가 없으면 "모델 준비 중" 안내를 띄운다.
const SLOW_HINT_MS = 8000;

interface AiStatus {
  ok: boolean;
  message: string;
  provider: string;
  model: string;
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

function parseIds(csv: string, all: { id: number }[]): Set<number> {
  const ids = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return new Set(all.map((a) => a.id)); // 빈 값 = 전체
  const valid = new Set(all.map((a) => a.id));
  return new Set(ids.filter((id) => valid.has(id)));
}

// 전체 선택(또는 미선택)은 "" 로 저장 → 백엔드에서 전체 주입
function serializeIncluded(sel: Set<number>, all: { id: number }[]): string {
  if (sel.size === 0 || sel.size >= all.length) return "";
  return [...sel].sort((a, b) => a - b).join(",");
}

export default function ChapterEditor({
  work,
  chapter,
  characters,
  worldSettings,
  prevChapter,
  ai,
}: {
  work: EditorWork;
  chapter: Chapter;
  characters: Character[];
  worldSettings: WorldSetting[];
  prevChapter: { number: number; summary: string } | null;
  ai: { provider: string; model: string };
}) {
  const [title, setTitle] = useState(chapter.title);
  const [beat, setBeat] = useState(chapter.beat);
  const [body, setBody] = useState(chapter.body);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [summary, setSummary] = useState(chapter.summary);
  const [persistent, setPersistent] = useState(work.persistent_conditions);
  const [published, setPublished] = useState(chapter.published === 1);
  const [publishing, setPublishing] = useState(false);
  const [selChars, setSelChars] = useState<Set<number>>(() =>
    parseIds(chapter.included_character_ids, characters),
  );
  const [selWorld, setSelWorld] = useState<Set<number>>(() =>
    parseIds(chapter.included_world_ids, worldSettings),
  );

  const incC = serializeIncluded(selChars, characters);
  const incW = serializeIncluded(selWorld, worldSettings);

  const [baseline, setBaseline] = useState({
    title: chapter.title,
    beat: chapter.beat,
    body: chapter.body,
    status: chapter.status,
    inc_c: chapter.included_character_ids,
    inc_w: chapter.included_world_ids,
  });

  const [condition, setCondition] = useState("");
  const [conditionMode, setConditionMode] = useState<"once" | "persistent">(
    "once",
  );

  const [busy, setBusy] = useState<null | GenMode | "save" | "summarize">(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [genInfo, setGenInfo] = useState<{ chars: number; secs: number } | null>(
    null,
  );
  const [waitingFirst, setWaitingFirst] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [tlSuggestions, setTlSuggestions] = useState<
    { description: string; involved_characters: string }[]
  >([]);

  const updatedAtRef = useRef(chapter.updated_at);
  const abortRef = useRef<AbortController | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genCharsRef = useRef(0);

  // AI 연결 상태 점검 (편집 화면에서 바로 보이게)
  async function checkAi() {
    setAiChecking(true);
    try {
      const r = await fetch("/api/ai/status", { cache: "no-store" });
      setAiStatus((await r.json()) as AiStatus);
    } catch {
      setAiStatus({
        ok: false,
        message: "상태를 확인하지 못했습니다.",
        provider: ai.provider,
        model: ai.model,
      });
    } finally {
      setAiChecking(false);
    }
  }

  useEffect(() => {
    void checkAi();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty =
    title !== baseline.title ||
    beat !== baseline.beat ||
    body !== baseline.body ||
    status !== baseline.status ||
    incC !== baseline.inc_c ||
    incW !== baseline.inc_w;

  const chars = useMemo(() => countChars(body), [body]);
  const pct = work.default_length
    ? Math.min(100, Math.round((chars / work.default_length) * 100))
    : 0;

  // 공통 저장
  async function persist(bodyOverride?: string): Promise<boolean> {
    const b = bodyOverride ?? body;
    const payload = {
      title,
      beat,
      body: b,
      status,
      included_character_ids: incC,
      included_world_ids: incW,
      expected_updated_at: updatedAtRef.current,
    };
    const res = await fetch(`/api/chapters/${chapter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const d = await res.json().catch(() => ({}));
      setConflict(d.error || "다른 곳에서 수정되었습니다.");
      return false;
    }
    if (!res.ok) {
      setError("저장 실패");
      return false;
    }
    const updated = await res.json();
    updatedAtRef.current = updated.updated_at;
    setBaseline({
      title,
      beat,
      body: b,
      status,
      inc_c: incC,
      inc_w: incW,
    });
    setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    return true;
  }

  async function manualSave() {
    setBusy("save");
    setError(null);
    try {
      await persist();
    } finally {
      setBusy(null);
    }
  }

  // 디바운스 자동 저장 (편집 1.5초 후)
  useEffect(() => {
    if (!dirty || busy || conflict) return;
    const t = setTimeout(() => {
      void persist();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy, conflict, title, beat, body, status, incC, incW]);

  async function generate(mode: GenMode) {
    if (busy) return;
    setBusy(mode);
    setError(null);
    setConflict(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const start = Date.now();
    let gotFirstByte = false;
    let timedOut = false;
    genCharsRef.current = 0;
    setGenInfo({ chars: 0, secs: 0 });
    setWaitingFirst(true);

    // 실시간 경과 타이머: 토큰이 아직 안 와도 '초'는 계속 흐른다 → 멈춘 것처럼 안 보이게
    tickRef.current = setInterval(() => {
      setGenInfo({ chars: genCharsRef.current, secs: (Date.now() - start) / 1000 });
    }, 200);
    // 첫 글자가 제한 시간 안에 안 오면 자동 중단하고 안내
    watchdogRef.current = setTimeout(() => {
      if (!gotFirstByte) {
        timedOut = true;
        controller.abort();
      }
    }, FIRST_BYTE_TIMEOUT_MS);

    const stopTimers = () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      tickRef.current = null;
      watchdogRef.current = null;
    };
    const timeoutMsg =
      `AI가 ${FIRST_BYTE_TIMEOUT_MS / 1000}초 동안 아무 응답이 없어 중단했어요. ` +
      `로컬(Ollama)이 안 켜졌거나 모델이 너무 클 수 있어요. ` +
      `아래 ‘다시 확인’으로 연결 상태를 보거나, ⚙️ AI 설정에서 더 작은 모델(qwen2.5:3b) 또는 클라우드(Claude)로 바꿔보세요.`;

    try {
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
        onceCondition = "";
      }

      const res = await fetch(`/api/chapters/${chapter.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          condition: conditionMode === "once" ? onceCondition : "",
          currentBody: body,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "집필 실패");
      }

      const base =
        mode === "continue" && body.trim() ? `${body.trimEnd()}\n\n` : "";
      let acc = base;
      genCharsRef.current = countChars(acc);
      setBody(base);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!gotFirstByte) {
            gotFirstByte = true;
            setWaitingFirst(false);
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
          }
          acc += decoder.decode(value, { stream: true });
          genCharsRef.current = countChars(acc);
          setBody(acc);
        }
      } catch (streamErr) {
        if (!(streamErr instanceof DOMException && streamErr.name === "AbortError"))
          throw streamErr;
        // 중단됨 (사용자 '중단' 또는 워치독) — 아래에서 분기 처리
      }

      if (timedOut && !gotFirstByte) {
        setError(timeoutMsg);
      } else if (gotFirstByte) {
        // 첫 글자라도 받았을 때만 저장 (빈 응답으로 기존 본문을 덮어쓰지 않도록)
        await persist(acc);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (timedOut) setError(timeoutMsg);
        // 그 외: 사용자가 응답 전에 '중단' — 본문 변경 없음
      } else {
        setError(e instanceof Error ? e.message : "오류");
      }
    } finally {
      stopTimers();
      abortRef.current = null;
      setBusy(null);
      setGenInfo(null);
      setWaitingFirst(false);
      void checkAi();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function togglePublish() {
    setPublishing(true);
    setError(null);
    try {
      // 발행 전 저장하지 않은 변경이 있으면 먼저 저장
      if (!published && dirty) await persist();
      const res = await fetch(`/api/chapters/${chapter.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발행 실패");
      setPublished(data.chapter.published === 1);
      const fails = (data.sent ?? []).filter(
        (s: { ok: boolean }) => !s.ok,
      );
      if (fails.length) {
        alert(
          "일부 자동 업로드 실패:\n" +
            fails
              .map((f: { label: string; error?: string }) => `- ${f.label}: ${f.error}`)
              .join("\n"),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setPublishing(false);
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
      updatedAtRef.current = (await refreshUpdatedAt()) ?? updatedAtRef.current;
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  // 요약 저장은 서버에서 updated_at 을 바꾸므로 최신값을 가져와 낙관적 락 동기화
  async function refreshUpdatedAt(): Promise<string | null> {
    const r = await fetch(`/api/chapters/${chapter.id}`, { cache: "no-store" });
    if (!r.ok) return null;
    const c = await r.json();
    return c.updated_at as string;
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

  async function addAllTimeline() {
    await Promise.all(
      tlSuggestions.map((item) =>
        fetch(`/api/works/${work.id}/timeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, chapter_id: chapter.id }),
        }),
      ),
    );
    setTlSuggestions([]);
  }

  function toggleChar(id: number) {
    setSelChars((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleWorld(id: number) {
    setSelWorld((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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
        <button
          className="btn-primary"
          onClick={manualSave}
          disabled={busy !== null || !dirty}
        >
          {busy === "save" ? "저장 중…" : dirty ? "저장*" : "저장됨"}
        </button>
        <button
          className={published ? "btn-secondary" : "btn-ghost"}
          onClick={togglePublish}
          disabled={publishing}
          title="공개 독자 사이트에 발행"
        >
          {publishing ? "처리 중…" : published ? "🌐 공개 중" : "발행"}
        </button>
      </div>

      {published && (
        <p className="mb-2 text-right text-xs">
          <a
            href={`/read/${work.id}/${chapter.number}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            독자 페이지에서 보기 ↗
          </a>
        </p>
      )}

      {savedAt && !dirty && (
        <p className="mb-2 text-right text-xs text-ink-500">{savedAt} 자동 저장됨</p>
      )}

      {conflict && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <span>{conflict}</span>
          <button
            className="btn-danger !px-2 !py-1 text-xs"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      )}

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

      {/* AI 연결 상태 — 여기서 바로 확인 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {aiStatus === null ? (
          <span className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 text-ink-400">
            AI 상태 확인 중…
          </span>
        ) : aiStatus.ok ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            ● AI 연결됨 · {aiStatus.provider === "ollama" ? "로컬 Ollama" : "Claude"} ·{" "}
            {aiStatus.model}
          </span>
        ) : (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-300">
            ● AI 연결 안 됨 — 생성이 안 됩니다
          </span>
        )}
        <button
          className="text-ink-400 hover:text-ink-200 disabled:opacity-50"
          onClick={checkAi}
          disabled={aiChecking}
        >
          {aiChecking ? "확인 중…" : "다시 확인"}
        </button>
        <Link href="/settings" className="text-amber-400 hover:underline">
          ⚙️ AI 설정
        </Link>
      </div>
      {aiStatus && !aiStatus.ok && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-200">
          {aiStatus.message}
        </div>
      )}

      {/* AI 버튼 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        {generating && (
          <button className="btn-danger" onClick={stop}>
            ■ 중단
          </button>
        )}
        {genInfo && (
          <span className="text-xs text-ink-400">
            {genInfo.chars.toLocaleString()}자 · {genInfo.secs.toFixed(1)}초
          </span>
        )}
        {generating && waitingFirst && genInfo && genInfo.secs * 1000 > SLOW_HINT_MS && (
          <span className="text-xs text-amber-300">
            ⏳ 첫 문장 준비 중… 로컬 모델은 처음 부를 때 수십 초~수 분 걸릴 수 있어요 (그대로 기다려 주세요)
          </span>
        )}
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
            className={`prose-novel min-h-[60vh] w-full resize-y rounded-lg border border-ink-800 bg-ink-900 p-4 focus:border-amber-500/60 focus:outline-none ${generating ? "opacity-70" : ""}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="여기에 본문이 표시됩니다. 직접 쓰거나 ‘자동 생성’으로 시작하세요."
            readOnly={generating}
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
            <p className="mt-2 text-xs text-ink-500">
              엔진:{" "}
              <span className="text-ink-300">
                {ai.provider === "ollama" ? "로컬 Ollama" : "Claude"} · {ai.model}
              </span>
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

          {/* 등장인물 선별 (§6) */}
          <details className="card" open={characters.length > 0 && characters.length <= 12}>
            <summary className="cursor-pointer text-xs font-semibold text-ink-300">
              등장인물 주입 ({incC === "" ? "전체" : `${selChars.size}/${characters.length}`})
            </summary>
            {characters.length === 0 ? (
              <p className="mt-2 text-xs text-ink-500">등록된 인물 없음</p>
            ) : (
              <>
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    className="text-amber-400 hover:underline"
                    onClick={() => setSelChars(new Set(characters.map((c) => c.id)))}
                  >
                    전체
                  </button>
                  <button
                    className="text-ink-400 hover:underline"
                    onClick={() => setSelChars(new Set())}
                  >
                    해제
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-300">
                  {characters.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selChars.has(c.id)}
                          onChange={() => toggleChar(c.id)}
                        />
                        {c.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-ink-600">
                  선택 안 함/전체 선택 = 전체 주입
                </p>
              </>
            )}
          </details>

          {/* 세계관 선별 */}
          <details className="card">
            <summary className="cursor-pointer text-xs font-semibold text-ink-300">
              세계관 주입 ({incW === "" ? "전체" : `${selWorld.size}/${worldSettings.length}`})
            </summary>
            {worldSettings.length === 0 ? (
              <p className="mt-2 text-xs text-ink-500">등록된 설정 없음</p>
            ) : (
              <>
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    className="text-amber-400 hover:underline"
                    onClick={() => setSelWorld(new Set(worldSettings.map((w) => w.id)))}
                  >
                    전체
                  </button>
                  <button
                    className="text-ink-400 hover:underline"
                    onClick={() => setSelWorld(new Set())}
                  >
                    해제
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-300">
                  {worldSettings.map((w) => (
                    <li key={w.id}>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selWorld.has(w.id)}
                          onChange={() => toggleWorld(w.id)}
                        />
                        [{w.category}] {w.title}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
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
              <div className="flex items-center justify-between">
                <p className="field-label text-amber-300">새 사건 기록 제안</p>
                <button
                  className="text-xs text-amber-400 hover:underline"
                  onClick={addAllTimeline}
                >
                  모두 추가
                </button>
              </div>
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
