"use client";

import { useEffect, useState } from "react";
import type { PublishTarget } from "@/lib/types";

export default function PublishTargets({ workId }: { workId: number }) {
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/works/${workId}/targets`, { cache: "no-store" })
      .then((r) => r.json())
      .then((t) => {
        setTargets(t);
        setLoading(false);
      });
  }, [workId]);

  function setField<K extends keyof PublishTarget>(
    id: number,
    key: K,
    value: PublishTarget[K],
  ) {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
    );
  }

  async function add() {
    const res = await fetch(`/api/works/${workId}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "discord", label: "" }),
    });
    const created = await res.json();
    setTargets((prev) => [...prev, created]);
  }

  async function save(t: PublishTarget) {
    setBusyId(t.id);
    try {
      await fetch(`/api/targets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: t.type,
          label: t.label,
          url: t.url,
          enabled: t.enabled,
        }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function test(t: PublishTarget) {
    setBusyId(t.id);
    try {
      await save(t);
      const res = await fetch(`/api/targets/${t.id}/test`, { method: "POST" });
      const d = await res.json();
      alert(d.ok ? "✓ 테스트 전송 성공" : `✗ 실패: ${d.error}`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("이 발행 대상을 삭제할까요?")) return;
    await fetch(`/api/targets/${id}`, { method: "DELETE" });
    setTargets((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold">자동 업로드(발행 대상)</h2>
      <p className="mt-1 text-xs text-ink-400">
        회차 “발행” 시 아래 대상으로 자동 전송됩니다. (문피아·네이버 등은 작가용
        공개 API가 없어 직접 게시는 불가 — 자체 서버·Zapier/Make·Discord 등으로
        연동하세요.)
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-ink-500">불러오는 중…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {targets.length === 0 && (
            <p className="text-sm text-ink-500">등록된 대상이 없습니다.</p>
          )}
          {targets.map((t) => (
            <div key={t.id} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs"
                  value={t.type}
                  onChange={(e) => setField(t.id, "type", e.target.value)}
                >
                  <option value="discord">Discord 웹훅</option>
                  <option value="webhook">일반 웹훅(POST JSON)</option>
                </select>
                <input
                  className="flex-1 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-sm"
                  value={t.label}
                  onChange={(e) => setField(t.id, "label", e.target.value)}
                  placeholder="이름(메모)"
                />
                <label className="flex items-center gap-1 text-xs text-ink-400">
                  <input
                    type="checkbox"
                    checked={t.enabled === 1}
                    onChange={(e) =>
                      setField(t.id, "enabled", e.target.checked ? 1 : 0)
                    }
                  />
                  사용
                </label>
              </div>
              <input
                className="field-input text-sm"
                value={t.url}
                onChange={(e) => setField(t.id, "url", e.target.value)}
                placeholder={
                  t.type === "discord"
                    ? "https://discord.com/api/webhooks/..."
                    : "https://example.com/your-endpoint"
                }
              />
              <div className="flex justify-end gap-2">
                <button
                  className="btn-ghost text-xs"
                  onClick={() => remove(t.id)}
                >
                  삭제
                </button>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => test(t)}
                  disabled={busyId === t.id || !t.url}
                >
                  테스트 전송
                </button>
                <button
                  className="btn-primary text-xs"
                  onClick={() => save(t)}
                  disabled={busyId === t.id}
                >
                  저장
                </button>
              </div>
            </div>
          ))}
          <button className="btn-secondary" onClick={add}>
            + 발행 대상 추가
          </button>
        </div>
      )}
    </div>
  );
}
