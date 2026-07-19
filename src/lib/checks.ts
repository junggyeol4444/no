import type {
  Chapter,
  Character,
  PlotPoint,
  TimelineEvent,
  WorldSetting,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// 규칙 기반 모순/실수 점검 (기획안 §2-2: "규칙 기반 + AI 검수").
// AI 호출 없이 결정적으로 잡아내는 명백한 항목들.
// ─────────────────────────────────────────────────────────────────────────

export function ruleBasedWarnings(input: {
  characters: Character[];
  worldSettings: WorldSetting[];
  plot: PlotPoint[];
  timeline: TimelineEvent[];
  chapters: Chapter[];
}): string[] {
  const out: string[] = [];
  const names = new Set(
    input.characters.map((c) => c.name.trim()).filter(Boolean),
  );

  // 타임라인 관련 인물이 캐릭터 목록에 없음 (오타/미등록)
  for (const t of input.timeline) {
    for (const who of (t.involved_characters || "")
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!names.has(who))
        out.push(
          `타임라인 "${t.description}" — 관련 인물 '${who}'이(가) 캐릭터 목록에 없습니다.`,
        );
    }
  }

  // 회차 번호 중복
  const numCount = new Map<number, number>();
  for (const c of input.chapters)
    numCount.set(c.number, (numCount.get(c.number) || 0) + 1);
  for (const [n, cnt] of numCount)
    if (cnt > 1) out.push(`${n}화가 ${cnt}개 있습니다 (회차 번호 중복).`);

  // 완료 상태인데 본문이 비어 있음
  for (const c of input.chapters)
    if (c.status === "완료" && c.body.trim().length === 0)
      out.push(`${c.number}화가 '완료' 상태인데 본문이 비어 있습니다.`);

  // 캐릭터 이름 중복
  const nameCount = new Map<string, number>();
  for (const c of input.characters) {
    const k = c.name.trim();
    if (k) nameCount.set(k, (nameCount.get(k) || 0) + 1);
  }
  for (const [k, cnt] of nameCount)
    if (cnt > 1) out.push(`'${k}' 이름의 캐릭터가 ${cnt}명 있습니다 (중복).`);

  // 같은 회차를 목표로 하는 플롯 비트가 여러 개
  const tcMap = new Map<number, string[]>();
  for (const p of input.plot)
    if (p.target_chapter) {
      const arr = tcMap.get(p.target_chapter) || [];
      arr.push(p.title);
      tcMap.set(p.target_chapter, arr);
    }
  for (const [tc, titles] of tcMap)
    if (titles.length > 1)
      out.push(`${tc}화를 목표로 하는 플롯 비트가 여러 개입니다: ${titles.join(", ")}`);

  return out;
}
