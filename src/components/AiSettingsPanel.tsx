"use client";

import { useEffect, useState } from "react";

interface AiSettings {
  provider: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  anthropicModel: string;
  anthropicKeyPresent: boolean;
}

interface Status {
  provider: string;
  model: string;
  ok: boolean;
  message: string;
  models: string[];
}

export default function AiSettingsPanel({ initial }: { initial: AiSettings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  function set<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function checkStatus() {
    setChecking(true);
    try {
      const res = await fetch("/api/ai/status", { cache: "no-store" });
      setStatus(await res.json());
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setForm(updated);
      await checkStatus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-serif text-2xl font-semibold">AI 설정</h1>
      <p className="mb-5 text-sm text-ink-400">
        집필·분석에 쓸 AI 공급자와 모델을 선택합니다. (작품 전체 공통)
      </p>

      {/* 현재 상태 */}
      <div
        className={`mb-5 rounded-lg border p-3 text-sm ${
          status?.ok
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : status
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-ink-700 bg-ink-900 text-ink-400"
        }`}
      >
        {!status ? (
          "상태 확인 중…"
        ) : (
          <>
            <span className="font-semibold">
              {status.ok ? "● 연결됨" : "● 사용 불가"}
            </span>{" "}
            — {status.provider === "ollama" ? "로컬 Ollama" : "Anthropic"} ·{" "}
            {status.model}
            <p className="mt-1 text-xs opacity-90">{status.message}</p>
          </>
        )}
      </div>

      {/* 공급자 선택 */}
      <div className="mb-4">
        <span className="field-label">공급자</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`rounded-lg border p-3 text-left text-sm ${
              form.provider === "ollama"
                ? "border-amber-500 bg-amber-500/10"
                : "border-ink-700 bg-ink-900"
            }`}
            onClick={() => set("provider", "ollama")}
          >
            <p className="font-semibold">로컬 (Ollama)</p>
            <p className="text-xs text-ink-400">키 없이 오프라인·무료</p>
          </button>
          <button
            className={`rounded-lg border p-3 text-left text-sm ${
              form.provider === "anthropic"
                ? "border-amber-500 bg-amber-500/10"
                : "border-ink-700 bg-ink-900"
            }`}
            onClick={() => set("provider", "anthropic")}
          >
            <p className="font-semibold">클라우드 (Claude)</p>
            <p className="text-xs text-ink-400">고품질, API 키 필요</p>
          </button>
        </div>
      </div>

      {/* Ollama 설정 */}
      {form.provider === "ollama" && (
        <div className="card mb-4 space-y-3">
          <div>
            <label className="field-label">Ollama 주소</label>
            <input
              className="field-input"
              value={form.ollamaBaseUrl}
              onChange={(e) => set("ollamaBaseUrl", e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="field-label">모델</label>
            <input
              className="field-input"
              list="ollama-models"
              value={form.ollamaModel}
              onChange={(e) => set("ollamaModel", e.target.value)}
              placeholder="qwen2.5:7b"
            />
            <datalist id="ollama-models">
              {(status?.models ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {status?.models && status.models.length > 0 ? (
              <p className="mt-1 text-xs text-ink-500">
                설치됨: {status.models.join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-500">
                터미널에서 <code className="text-ink-300">ollama pull {form.ollamaModel || "qwen2.5:7b"}</code> 로 모델을 받으세요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Anthropic 설정 */}
      {form.provider === "anthropic" && (
        <div className="card mb-4 space-y-3">
          <div>
            <label className="field-label">모델</label>
            <input
              className="field-input"
              value={form.anthropicModel}
              onChange={(e) => set("anthropicModel", e.target.value)}
              placeholder="claude-sonnet-4-6"
            />
          </div>
          <div className="text-xs">
            <span className="field-label">API 키</span>
            {form.anthropicKeyPresent ? (
              <span className="text-emerald-300">✓ .env.local 에서 감지됨</span>
            ) : (
              <span className="text-amber-300">
                ✗ 미설정 — <code className="text-ink-300">.env.local</code> 에{" "}
                <code className="text-ink-300">ANTHROPIC_API_KEY</code> 를 추가하세요. (보안상 키는 화면이 아닌 파일로 관리)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          className="btn-secondary"
          onClick={checkStatus}
          disabled={checking}
        >
          {checking ? "확인 중…" : "연결 확인"}
        </button>
      </div>
    </div>
  );
}
