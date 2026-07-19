import { checkConsistency, AiUnavailableError } from "@/lib/ai";
import { ruleBasedWarnings } from "@/lib/checks";
import { badRequest, json, parseId, serverError } from "@/lib/http";
import {
  getWork,
  listChapters,
  listCharacters,
  listPlotPoints,
  listTimeline,
  listWorldSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 규칙 기반(항상) + AI 검수(가능 시)로 모순을 점검 (기획안 §2-2)
export async function POST(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  if (!getWork(workId)) return badRequest("작품이 존재하지 않습니다");

  const characters = listCharacters(workId);
  const worldSettings = listWorldSettings(workId);
  const plot = listPlotPoints(workId);
  const timeline = listTimeline(workId);
  const chapters = listChapters(workId);

  // 규칙 기반은 AI 없이도 항상 동작
  const ruleWarnings = ruleBasedWarnings({
    characters,
    worldSettings,
    plot,
    timeline,
    chapters,
  });

  try {
    const ai = await checkConsistency({
      characters: characters.map((c) => ({
        name: c.name,
        secrets: c.secrets,
        goal: c.goal,
      })),
      worldSettings: worldSettings.map((w) => ({
        category: w.category,
        title: w.title,
        content: w.content,
      })),
      timeline: timeline.map((t) => ({
        description: t.description,
        involved_characters: t.involved_characters,
      })),
      chapters: chapters.map((c) => ({
        number: c.number,
        title: c.title,
        summary: c.summary,
      })),
    });
    return json({
      warnings: ai.warnings,
      rule_warnings: ruleWarnings,
      ai_ok: true,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError)
      return json({
        warnings: [],
        rule_warnings: ruleWarnings,
        ai_ok: false,
        ai_message: err.message,
      });
    if (err instanceof SyntaxError)
      return json({
        warnings: [],
        rule_warnings: ruleWarnings,
        ai_ok: false,
        ai_message: "AI 응답을 해석하지 못했습니다.",
      });
    return serverError(err instanceof Error ? err.message : "점검 실패");
  }
}
