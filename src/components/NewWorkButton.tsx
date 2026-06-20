"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewWorkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    genre: "",
    tone: "",
    default_length: 2000,
    synopsis: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("작품 생성 실패");
      const work = await res.json();
      router.push(`/works/${work.id}/chapters`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류");
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 새 작품
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-serif text-lg font-semibold">새 작품 만들기</h2>
            <div className="space-y-3">
              <div>
                <label className="field-label">제목 *</label>
                <input
                  autoFocus
                  className="field-input"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="예) 회귀한 검성의 두 번째 삶"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">장르</label>
                  <input
                    className="field-input"
                    value={form.genre}
                    onChange={(e) => update("genre", e.target.value)}
                    placeholder="판타지, 로맨스, 무협…"
                  />
                </div>
                <div>
                  <label className="field-label">톤/문체</label>
                  <input
                    className="field-input"
                    value={form.tone}
                    onChange={(e) => update("tone", e.target.value)}
                    placeholder="진지함, 가벼움, 어두움…"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">회차 기본 분량 (글자, 공백 제외)</label>
                <input
                  type="number"
                  className="field-input"
                  value={form.default_length}
                  onChange={(e) =>
                    update("default_length", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label className="field-label">시놉시스 (선택)</label>
                <textarea
                  className="field-input min-h-[80px] resize-y"
                  value={form.synopsis}
                  onChange={(e) => update("synopsis", e.target.value)}
                  placeholder="작품의 핵심 줄거리를 간단히…"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                취소
              </button>
              <button
                className="btn-primary"
                onClick={submit}
                disabled={saving || !form.title.trim()}
              >
                {saving ? "생성 중…" : "작품 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
