"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CHAPTER_STATUSES,
  type Chapter,
  type ChapterStatus,
} from "@/lib/types";

const STATUS_STYLE: Record<ChapterStatus, string> = {
  초고: "bg-ink-700 text-ink-200",
  퇴고: "bg-amber-500/20 text-amber-300",
  완료: "bg-emerald-500/20 text-emerald-300",
};

export default function ChapterList({
  workId,
  defaultLength,
  initial,
}: {
  workId: number;
  defaultLength: number;
  initial: Chapter[];
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>(initial);
  const [creating, setCreating] = useState(false);

  async function reload() {
    const res = await fetch(`/api/works/${workId}/chapters`, {
      cache: "no-store",
    });
    setChapters(await res.json());
  }

  async function createChapter() {
    setCreating(true);
    try {
      const res = await fetch(`/api/works/${workId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const ch = await res.json();
      router.push(`/works/${workId}/chapters/${ch.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function insertAfter(number: number) {
    await fetch(`/api/works/${workId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ after: number }),
    });
    await reload();
  }

  async function setStatus(id: number, status: ChapterStatus) {
    const res = await fetch(`/api/chapters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated = await res.json();
    setChapters((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function remove(id: number, number: number) {
    if (!confirm(`${number}화를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await fetch(`/api/chapters/${id}`, { method: "DELETE" });
    setChapters((prev) => prev.filter((c) => c.id !== id));
  }

  const totalChars = chapters.reduce((s, c) => s + c.word_count, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl font-semibold">회차 목록</h1>
          <p className="text-sm text-ink-400">
            전체 {chapters.length}화 · {totalChars.toLocaleString()}자 · 목표{" "}
            {defaultLength.toLocaleString()}자/회
          </p>
        </div>
        <div className="flex items-center gap-2">
          {chapters.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-ink-500">전체 내보내기:</span>
              <a
                className="btn-ghost !px-2 !py-1"
                href={`/api/works/${workId}/export?format=txt`}
              >
                txt
              </a>
              <a
                className="btn-ghost !px-2 !py-1"
                href={`/api/works/${workId}/export?format=md`}
              >
                md
              </a>
            </div>
          )}
          <button className="btn-primary" onClick={createChapter} disabled={creating}>
            {creating ? "생성 중…" : "+ 새 회차"}
          </button>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="card text-center text-sm text-ink-400">
          아직 회차가 없습니다. “새 회차”로 첫 회차를 만들고 AI로 집필해 보세요.
        </div>
      ) : (
        <div className="space-y-2">
          {chapters.map((c) => {
            const pct = defaultLength
              ? Math.min(100, Math.round((c.word_count / defaultLength) * 100))
              : 0;
            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900 px-4 py-3"
              >
                <span className="w-12 shrink-0 font-serif text-lg font-semibold text-ink-300">
                  {c.number}화
                </span>
                <Link
                  href={`/works/${workId}/chapters/${c.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium text-ink-100 hover:text-amber-400">
                    {c.title || "(제목 없음)"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-500">
                      {c.word_count.toLocaleString()}자
                    </span>
                  </div>
                </Link>
                <button
                  className="btn-ghost hidden text-xs group-hover:inline-flex"
                  onClick={() => insertAfter(c.number)}
                  title="이 회차 다음에 삽입"
                >
                  ↳삽입
                </button>
                <select
                  className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[c.status]}`}
                  value={c.status}
                  onChange={(e) => setStatus(c.id, e.target.value as ChapterStatus)}
                >
                  {CHAPTER_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-ink-900 text-ink-100">
                      {s}
                    </option>
                  ))}
                </select>
                <a
                  className="btn-ghost"
                  href={`/api/chapters/${c.id}/export`}
                  title="이 회차 txt 내보내기"
                >
                  ⬇
                </a>
                <button
                  className="btn-ghost"
                  onClick={() => remove(c.id, c.number)}
                  title="삭제"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
