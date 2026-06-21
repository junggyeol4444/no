"use client";

import { useState } from "react";
import type { Chapter, PlotPoint, TimelineEvent } from "@/lib/types";

function PlotRow({
  point,
  index,
  total,
  onSaved,
  onDeleted,
  onMove,
}: {
  point: PlotPoint;
  index: number;
  total: number;
  onSaved: (p: PlotPoint) => void;
  onDeleted: (id: number) => void;
  onMove: (id: number, dir: -1 | 1) => void;
}) {
  const [title, setTitle] = useState(point.title);
  const [description, setDescription] = useState(point.description);
  const [target, setTarget] = useState<string>(
    point.target_chapter ? String(point.target_chapter) : "",
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== point.title ||
    description !== point.description ||
    target !== (point.target_chapter ? String(point.target_chapter) : "");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/plot/${point.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          target_chapter: target ? Number(target) : null,
        }),
      });
      onSaved(await res.json());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <div className="flex flex-col text-ink-500">
          <button
            className="leading-none hover:text-ink-200 disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove(point.id, -1)}
            title="위로"
          >
            ▲
          </button>
          <button
            className="leading-none hover:text-ink-200 disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMove(point.id, 1)}
            title="아래로"
          >
            ▼
          </button>
        </div>
        <span className="chip">{index + 1}</span>
        <input
          className="flex-1 bg-transparent font-serif font-semibold focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="비트 제목 (예: 발단 - 회귀)"
        />
        <input
          className="w-20 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs"
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="목표 회차"
          title="이 비트의 목표 회차"
        />
        {dirty && (
          <button className="btn-primary !px-2 !py-1 text-xs" onClick={save} disabled={saving}>
            저장
          </button>
        )}
        <button
          className="btn-ghost"
          onClick={() => onDeleted(point.id)}
          title="삭제"
        >
          🗑
        </button>
      </div>
      <textarea
        className="field-input mt-2 resize-y text-sm"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="이 단계에서 일어나는 일…"
      />
    </div>
  );
}

export default function PlotTimeline({
  workId,
  initialPlot,
  initialTimeline,
  chapters,
}: {
  workId: number;
  initialPlot: PlotPoint[];
  initialTimeline: TimelineEvent[];
  chapters: Pick<Chapter, "id" | "number" | "title">[];
}) {
  const [plot, setPlot] = useState<PlotPoint[]>(initialPlot);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(initialTimeline);
  const [tlDesc, setTlDesc] = useState("");
  const [tlWho, setTlWho] = useState("");
  const [tlChapter, setTlChapter] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{
    warnings: string[];
    rule_warnings: string[];
    ai_ok: boolean;
    ai_message?: string;
  } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function addPlot() {
    const res = await fetch(`/api/works/${workId}/plot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "새 비트" }),
    });
    const created = await res.json();
    setPlot((prev) => [...prev, created]);
  }

  async function deletePlot(id: number) {
    await fetch(`/api/plot/${id}`, { method: "DELETE" });
    setPlot((prev) => prev.filter((p) => p.id !== id));
  }

  async function movePlot(id: number, dir: -1 | 1) {
    const idx = plot.findIndex((p) => p.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= plot.length) return;
    const a = plot[idx];
    const b = plot[swapIdx];
    // order_index 교환 후 재정렬
    const next = [...plot];
    next[idx] = b;
    next[swapIdx] = a;
    setPlot(next);
    await Promise.all([
      fetch(`/api/plot/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: b.order_index }),
      }),
      fetch(`/api/plot/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: a.order_index }),
      }),
    ]);
  }

  async function addEvent() {
    if (!tlDesc.trim()) return;
    const res = await fetch(`/api/works/${workId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: tlDesc,
        involved_characters: tlWho,
        chapter_id: tlChapter ? Number(tlChapter) : null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTimeline((prev) => [...prev, created]);
      setTlDesc("");
      setTlWho("");
      setTlChapter("");
    }
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/timeline/${id}`, { method: "DELETE" });
    setTimeline((prev) => prev.filter((t) => t.id !== id));
  }

  async function runCheck() {
    setChecking(true);
    setCheckError(null);
    setCheck(null);
    try {
      const res = await fetch(`/api/works/${workId}/check`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "점검 실패");
      setCheck({
        warnings: data.warnings ?? [],
        rule_warnings: data.rule_warnings ?? [],
        ai_ok: data.ai_ok ?? false,
        ai_message: data.ai_message,
      });
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "오류");
    } finally {
      setChecking(false);
    }
  }

  function chapterLabel(id: number | null) {
    if (!id) return null;
    const ch = chapters.find((c) => c.id === id);
    return ch ? `${ch.number}화` : null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">플롯 / 타임라인</h1>
          <p className="text-sm text-ink-400">
            전체 플롯 라인과 “이미 일어난 일”을 관리해 일관성을 유지합니다.
          </p>
        </div>
        <button className="btn-secondary" onClick={runCheck} disabled={checking}>
          {checking ? "점검 중…" : "🔎 AI 일관성 점검"}
        </button>
      </div>

      {checkError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {checkError}
        </div>
      )}
      {check && (
        <div className="space-y-2">
          {check.rule_warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-300">
                📐 규칙 기반 점검 {check.rule_warnings.length}건
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-amber-100/90">
                {check.rule_warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {check.ai_ok && check.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-300">
                🔎 AI 검수 {check.warnings.length}건
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-amber-100/90">
                {check.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {check.ai_ok &&
            check.warnings.length === 0 &&
            check.rule_warnings.length === 0 && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                ✓ 명백한 모순을 찾지 못했습니다.
              </div>
            )}
          {!check.ai_ok && (
            <div className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-ink-400">
              AI 검수는 건너뜀{check.ai_message ? ` — ${check.ai_message}` : ""} · 규칙 기반 결과만 표시
            </div>
          )}
        </div>
      )}

      {/* 플롯 라인 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-300">
          플롯 라인 (기-승-전-결 또는 자유 구조)
        </h2>
        <div className="space-y-3">
          {plot.length === 0 && (
            <div className="card text-sm text-ink-400">
              아직 등록된 플롯 비트가 없습니다.
            </div>
          )}
          {plot.map((p, i) => (
            <PlotRow
              key={p.id}
              point={p}
              index={i}
              total={plot.length}
              onSaved={(u) =>
                setPlot((prev) => prev.map((x) => (x.id === u.id ? u : x)))
              }
              onDeleted={deletePlot}
              onMove={movePlot}
            />
          ))}
          <button className="btn-secondary" onClick={addPlot}>
            + 비트 추가
          </button>
        </div>
      </section>

      {/* 타임라인 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-300">
          타임라인 — 이미 일어난 일
        </h2>
        <div className="card mb-3 space-y-2">
          <textarea
            className="field-input resize-y text-sm"
            rows={2}
            value={tlDesc}
            onChange={(e) => setTlDesc(e.target.value)}
            placeholder="일어난 사건을 한 줄로… (예: 카엘이 서리 군단장과의 결투에서 승리)"
          />
          <div className="flex flex-wrap gap-2">
            <input
              className="field-input flex-1"
              value={tlWho}
              onChange={(e) => setTlWho(e.target.value)}
              placeholder="관련 인물 (쉼표 구분)"
            />
            <select
              className="rounded-md border border-ink-700 bg-ink-900 px-2 text-sm text-ink-200"
              value={tlChapter}
              onChange={(e) => setTlChapter(e.target.value)}
            >
              <option value="">회차 연결 (선택)</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number}화 {c.title}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={addEvent} disabled={!tlDesc.trim()}>
              기록
            </button>
          </div>
        </div>
        <ol className="space-y-2">
          {timeline.length === 0 && (
            <div className="card text-sm text-ink-400">
              아직 기록된 사건이 없습니다.
            </div>
          )}
          {timeline.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-2 rounded-md border border-ink-800 bg-ink-900 px-3 py-2"
            >
              <span className="mt-0.5 text-ink-600">•</span>
              <div className="flex-1">
                <p className="text-sm text-ink-100">{t.description}</p>
                <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-ink-500">
                  {chapterLabel(t.chapter_id) && (
                    <span className="chip">{chapterLabel(t.chapter_id)}</span>
                  )}
                  {t.involved_characters && <span>관련: {t.involved_characters}</span>}
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => deleteEvent(t.id)}
                title="삭제"
              >
                🗑
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
