import { checkConsistency, MissingApiKeyError } from "@/lib/anthropic";
import { badRequest, json, parseId, serverError } from "@/lib/http";
import {
  getWork,
  listChapters,
  listCharacters,
  listTimeline,
  listWorldSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 규칙 기반 + AI 검수로 명백한 모순을 점검 (기획안 §2-2)
export async function POST(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  if (!getWork(workId)) return badRequest("작품이 존재하지 않습니다");

  try {
    const result = await checkConsistency({
      characters: listCharacters(workId).map((c) => ({
        name: c.name,
        secrets: c.secrets,
        goal: c.goal,
      })),
      worldSettings: listWorldSettings(workId).map((w) => ({
        category: w.category,
        title: w.title,
        content: w.content,
      })),
      timeline: listTimeline(workId).map((t) => ({
        description: t.description,
        involved_characters: t.involved_characters,
      })),
      chapters: listChapters(workId).map((c) => ({
        number: c.number,
        title: c.title,
        summary: c.summary,
      })),
    });
    return json(result);
  } catch (err) {
    if (err instanceof MissingApiKeyError) return badRequest(err.message);
    if (err instanceof SyntaxError)
      return serverError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
    return serverError(err instanceof Error ? err.message : "점검 실패");
  }
}
