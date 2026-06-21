"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "로그인 실패");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <h1 className="mb-4 text-center font-serif text-xl font-semibold">
        WebNovel Studio
      </h1>
      <form onSubmit={submit} className="card space-y-3">
        <div>
          <label className="field-label">비밀번호</label>
          <input
            type="password"
            autoFocus
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </div>
  );
}
