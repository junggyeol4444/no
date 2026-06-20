"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextAreaField, TextField } from "@/components/Field";
import type { Work } from "@/lib/types";

export default function WorkSettings({ work }: { work: Work }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: work.title,
    genre: work.genre,
    tone: work.tone,
    default_length: work.default_length,
    synopsis: work.synopsis,
    persistent_conditions: work.persistent_conditions,
  });
  const [baseline, setBaseline] = useState(form);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${work.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("저장 실패");
      setBaseline(form);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  async function removeWork() {
    if (
      !confirm(
        `'${work.title}' 작품을 삭제할까요?\n회차·캐릭터·설정·플롯이 모두 삭제되며 되돌릴 수 없습니다.`,
      )
    )
      return;
    await fetch(`/api/works/${work.id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-serif text-xl font-semibold">작품 설정</h1>

      <div className="space-y-3">
        <TextField label="제목" value={form.title} onChange={(v) => set("title", v)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="장르" value={form.genre} onChange={(v) => set("genre", v)} />
          <TextField label="톤/문체" value={form.tone} onChange={(v) => set("tone", v)} />
        </div>
        <div>
          <label className="field-label">회차 기본 분량 (글자, 공백 제외)</label>
          <input
            type="number"
            className="field-input"
            value={form.default_length}
            onChange={(e) => set("default_length", Number(e.target.value) || 0)}
          />
        </div>
        <TextAreaField
          label="시놉시스"
          value={form.synopsis}
          onChange={(v) => set("synopsis", v)}
          rows={3}
        />
        <TextAreaField
          label="지속 집필 조건 (작품 전체에 항상 적용)"
          value={form.persistent_conditions}
          onChange={(v) => set("persistent_conditions", v)}
          rows={3}
        />
        <p className="text-xs text-ink-500">
          예) “문체는 담백하게, 대사 위주로. 잔혹 묘사는 피한다.” — 모든 회차 집필 시 자동 적용됩니다.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "저장 중…" : "설정 저장"}
        </button>
        {savedAt && !dirty && (
          <span className="text-xs text-ink-500">{savedAt} 저장됨</span>
        )}
      </div>

      <div className="mt-10 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-sm font-semibold text-red-300">위험 구역</p>
        <p className="mt-1 text-xs text-ink-400">
          작품과 모든 하위 데이터를 영구 삭제합니다.
        </p>
        <button className="btn-danger mt-3" onClick={removeWork}>
          작품 삭제
        </button>
      </div>
    </div>
  );
}
