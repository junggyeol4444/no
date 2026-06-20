"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AnalyzePanel from "@/components/AnalyzePanel";
import { WORLD_CATEGORIES, type WorldSetting } from "@/lib/types";

type Draft = Pick<WorldSetting, "id" | "work_id" | "category" | "title" | "content">;

function draft0(w: WorldSetting): Draft {
  const { id, work_id, category, title, content } = w;
  return { id, work_id, category, title, content };
}

function WorldCard({
  item,
  onSaved,
  onDeleted,
}: {
  item: WorldSetting;
  onSaved: (w: WorldSetting) => void;
  onDeleted: (id: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draft0(item));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draft0(item));

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/world/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("저장 실패");
      onSaved(await res.json());
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`'${item.title}' 항목을 삭제할까요?`)) return;
    await fetch(`/api/world/${item.id}`, { method: "DELETE" });
    onDeleted(item.id);
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200"
          value={draft.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {WORLD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="flex-1 bg-transparent font-serif text-base font-semibold focus:outline-none"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="항목 제목"
        />
        {dirty && <span className="chip bg-amber-500/20 text-amber-300">변경됨</span>}
        <button className="btn-ghost" onClick={remove} title="삭제">
          🗑
        </button>
      </div>
      <textarea
        className="field-input mt-3 resize-y"
        rows={3}
        value={draft.content}
        onChange={(e) => set("content", e.target.value)}
        placeholder="설정 내용…"
      />
      <div className="mt-2 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

export default function WorldManager({
  workId,
  initial,
}: {
  workId: number;
  initial: WorldSetting[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<WorldSetting[]>(initial);
  const [mode, setMode] = useState<"direct" | "analyze">("direct");
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    try {
      const res = await fetch(`/api/works/${workId}/world`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "새 설정", category: "용어" }),
      });
      const created = await res.json();
      setItems((prev) => [...prev, created]);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">세계관 / 설정집</h1>
          <p className="text-sm text-ink-400">
            시대·규칙·지명·세력·용어 등 작품의 제약 조건입니다.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-ink-700 p-0.5 text-sm">
          <button
            className={`rounded px-3 py-1 ${mode === "direct" ? "bg-ink-700 text-ink-100" : "text-ink-400"}`}
            onClick={() => setMode("direct")}
          >
            직접 입력
          </button>
          <button
            className={`rounded px-3 py-1 ${mode === "analyze" ? "bg-ink-700 text-ink-100" : "text-ink-400"}`}
            onClick={() => setMode("analyze")}
          >
            텍스트 붙여넣기 → 자동 분석
          </button>
        </div>
      </div>

      {mode === "analyze" ? (
        <AnalyzePanel
          workId={workId}
          target="world"
          onImported={() => {
            setMode("direct");
            router.refresh();
          }}
        />
      ) : (
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="card text-center text-sm text-ink-400">
              아직 설정이 없습니다. 직접 추가하거나 자동 분석으로 등록하세요.
            </div>
          )}
          {items.map((w) => (
            <WorldCard
              key={w.id}
              item={w}
              onSaved={(u) =>
                setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))
              }
              onDeleted={(id) =>
                setItems((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
          <button className="btn-secondary" onClick={add} disabled={adding}>
            + 설정 항목 추가
          </button>
        </div>
      )}
    </div>
  );
}
