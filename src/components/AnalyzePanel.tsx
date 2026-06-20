"use client";

import { useState } from "react";
import {
  WORLD_CATEGORIES,
  type AnalysisResult,
  type AnalyzedCharacter,
  type AnalyzedWorldSetting,
} from "@/lib/types";

type Target = "characters" | "world";
type CharItem = AnalyzedCharacter & { _accepted: boolean };
type WorldItem = AnalyzedWorldSetting & { _accepted: boolean };

const CHAR_FIELDS: { key: keyof AnalyzedCharacter; label: string }[] = [
  { key: "appearance", label: "외형" },
  { key: "personality", label: "성격" },
  { key: "speech_style", label: "말투" },
  { key: "goal", label: "목표" },
  { key: "relationships", label: "관계" },
  { key: "secrets", label: "비밀" },
  { key: "notes", label: "메모" },
];

export default function AnalyzePanel({
  workId,
  target,
  onImported,
}: {
  workId: number;
  target: Target;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [charItems, setCharItems] = useState<CharItem[]>([]);
  const [worldItems, setWorldItems] = useState<WorldItem[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  async function analyze() {
    if (text.trim().length < 5) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/works/${workId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      const result = data as AnalysisResult;
      setSuggestions(result.suggestions ?? []);
      setCharItems(
        (result.characters ?? []).map((c) => ({ ...c, _accepted: true })),
      );
      setWorldItems(
        (result.world_settings ?? []).map((w) => ({ ...w, _accepted: true })),
      );
      setSubmitted(text);
      setAnalyzed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const chars = charItems.filter((c) => c._accepted).map(strip);
    const worlds = worldItems.filter((w) => w._accepted).map(strip);
    if (chars.length === 0 && worlds.length === 0) {
      setError("채택된 항목이 없습니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/works/${workId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          characters: target === "characters" ? chars : [],
          world_settings: target === "world" ? worlds : [],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "저장 실패");
      }
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount =
    target === "characters"
      ? charItems.filter((c) => c._accepted).length
      : worldItems.filter((w) => w._accepted).length;

  return (
    <div className="space-y-4">
      <div className="card">
        <label className="field-label">
          설정 글 붙여넣기 (캐릭터 소개, 세계관 메모 등)
        </label>
        <textarea
          className="field-input min-h-[140px] resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            target === "characters"
              ? "예) 카엘은 은발에 잿빛 눈동자를 가진 27세 검사다. 냉소적이지만 동료에게는 따뜻하다. 잃어버린 여동생을 찾는 것이 목표이며…"
              : "예) 이 세계는 마나를 다루는 '각인사'들이 지배한다. 각인은 태어날 때 한 번만 새겨지며 바꿀 수 없다. 북부의 세력 '서리 군단'은…"
          }
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-ink-500">
            AI가 필드별로 분류해 제안합니다. 저장 전 검수·수정할 수 있어요.
          </p>
          <button className="btn-primary" onClick={analyze} disabled={loading}>
            {loading ? "분석 중…" : "분석하기"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {analyzed && (
        <>
          {suggestions.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-300">
                💡 보완 제안
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-100/90">
                {suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 좌: 원문 */}
            <div className="card">
              <p className="field-label">원문</p>
              <p className="whitespace-pre-wrap text-sm text-ink-400">
                {submitted}
              </p>
            </div>

            {/* 우: 분류 결과 */}
            <div className="space-y-3">
              <p className="field-label">분류 결과 (채택할 항목 선택)</p>

              {target === "characters" &&
                charItems.map((c, i) => (
                  <div
                    key={i}
                    className={`card ${c._accepted ? "" : "opacity-50"}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c._accepted}
                        onChange={(e) =>
                          setCharItems((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, _accepted: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      <input
                        className="flex-1 bg-transparent font-serif font-semibold focus:outline-none"
                        value={c.name}
                        onChange={(e) =>
                          setCharItems((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {CHAR_FIELDS.map((f) => (
                        <div key={f.key}>
                          <label className="field-label">{f.label}</label>
                          <textarea
                            className="field-input resize-y text-xs"
                            rows={1}
                            value={c[f.key]}
                            onChange={(e) =>
                              setCharItems((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, [f.key]: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {target === "world" &&
                worldItems.map((w, i) => (
                  <div
                    key={i}
                    className={`card ${w._accepted ? "" : "opacity-50"}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={w._accepted}
                        onChange={(e) =>
                          setWorldItems((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, _accepted: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      <select
                        className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs"
                        value={w.category}
                        onChange={(e) =>
                          setWorldItems((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, category: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        {WORLD_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 bg-transparent font-serif font-semibold focus:outline-none"
                        value={w.title}
                        onChange={(e) =>
                          setWorldItems((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <textarea
                      className="field-input resize-y text-xs"
                      rows={2}
                      value={w.content}
                      onChange={(e) =>
                        setWorldItems((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, content: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}

              {((target === "characters" && charItems.length === 0) ||
                (target === "world" && worldItems.length === 0)) && (
                <div className="card text-sm text-ink-400">
                  추출된 항목이 없습니다. 텍스트를 더 구체적으로 작성해 보세요.
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-ink-500">
                  {acceptedCount}개 채택됨
                </span>
                <button
                  className="btn-primary"
                  onClick={save}
                  disabled={saving || acceptedCount === 0}
                >
                  {saving ? "저장 중…" : "채택 항목 저장"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function strip<T extends { _accepted: boolean }>(item: T): Omit<T, "_accepted"> {
  const { _accepted, ...rest } = item;
  void _accepted;
  return rest;
}
