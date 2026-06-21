"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AnalyzePanel from "@/components/AnalyzePanel";
import { TextAreaField, TextField } from "@/components/Field";
import type { Character } from "@/lib/types";

type Draft = Omit<Character, "created_at">;

function draft0(c: Character): Draft {
  const { created_at, ...rest } = c;
  void created_at;
  return rest;
}

function CharacterCard({
  character,
  index,
  total,
  reorderable,
  onSaved,
  onDeleted,
  onMove,
}: {
  character: Character;
  index: number;
  total: number;
  reorderable: boolean;
  onSaved: (c: Character) => void;
  onDeleted: (id: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draft0(character));
  const [open, setOpen] = useState(!character.appearance && !character.personality);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(draft0(character));

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
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
    if (!confirm(`'${character.name}' 캐릭터를 삭제할까요?`)) return;
    await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    onDeleted(character.id);
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        {reorderable && (
          <div className="flex flex-col text-ink-600">
            <button
              className="leading-none hover:text-ink-200 disabled:opacity-30"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
              title="위로"
            >
              ▲
            </button>
            <button
              className="leading-none hover:text-ink-200 disabled:opacity-30"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
              title="아래로"
            >
              ▼
            </button>
          </div>
        )}
        <button
          className="text-ink-500 hover:text-ink-200"
          onClick={() => setOpen((o) => !o)}
          aria-label="펼치기/접기"
        >
          {open ? "▾" : "▸"}
        </button>
        <input
          className="flex-1 bg-transparent font-serif text-base font-semibold text-ink-100 focus:outline-none"
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="캐릭터 이름"
        />
        {dirty && <span className="chip bg-amber-500/20 text-amber-300">변경됨</span>}
        <button className="btn-ghost" onClick={remove} title="삭제">
          🗑
        </button>
      </div>

      {!open && (
        <p className="mt-1 line-clamp-1 pl-7 text-xs text-ink-500">
          {draft.personality || draft.goal || draft.appearance || "설정 없음"}
        </p>
      )}

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextAreaField label="외형" value={draft.appearance} onChange={(v) => set("appearance", v)} />
          <TextAreaField label="성격" value={draft.personality} onChange={(v) => set("personality", v)} />
          <TextField label="말투" value={draft.speech_style} onChange={(v) => set("speech_style", v)} />
          <TextAreaField label="목표" value={draft.goal} onChange={(v) => set("goal", v)} />
          <TextAreaField label="관계" value={draft.relationships} onChange={(v) => set("relationships", v)} />
          <TextAreaField label="비밀" value={draft.secrets} onChange={(v) => set("secrets", v)} />
          <div className="sm:col-span-2">
            <TextAreaField label="기타 메모" value={draft.notes} onChange={(v) => set("notes", v)} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CharacterManager({
  workId,
  initial,
}: {
  workId: number;
  initial: Character[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Character[]>(initial);
  const [mode, setMode] = useState<"direct" | "analyze">("direct");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.name, c.personality, c.goal, c.appearance, c.relationships, c.notes]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  const reorderable = query.trim().length === 0;

  async function add() {
    setAdding(true);
    try {
      const res = await fetch(`/api/works/${workId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 캐릭터" }),
      });
      const created = await res.json();
      setItems((prev) => [...prev, created]);
    } finally {
      setAdding(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    const normalized = next.map((c, i) => ({ ...c, order_index: i }));
    const changed = normalized.filter(
      (c) => items.find((o) => o.id === c.id)?.order_index !== c.order_index,
    );
    setItems(normalized);
    await Promise.all(
      changed.map((c) =>
        fetch(`/api/characters/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: c.order_index }),
        }),
      ),
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">캐릭터 관리</h1>
          <p className="text-sm text-ink-400">
            집필 시 AI에게 주입되는 인물 카드입니다.
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
          target="characters"
          onImported={() => {
            setMode("direct");
            router.refresh();
          }}
        />
      ) : (
        <div className="space-y-3">
          {items.length > 3 && (
            <input
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="캐릭터 검색… (검색 중에는 순서 변경 비활성)"
            />
          )}
          {filtered.length === 0 && (
            <div className="card text-center text-sm text-ink-400">
              {items.length === 0
                ? "아직 캐릭터가 없습니다. 아래 버튼으로 추가하거나, 자동 분석으로 한 번에 등록하세요."
                : "검색 결과가 없습니다."}
            </div>
          )}
          {filtered.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              index={items.indexOf(c)}
              total={items.length}
              reorderable={reorderable}
              onMove={move}
              onSaved={(u) =>
                setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))
              }
              onDeleted={(id) =>
                setItems((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
          <button className="btn-secondary" onClick={add} disabled={adding}>
            + 캐릭터 추가
          </button>
        </div>
      )}
    </div>
  );
}
