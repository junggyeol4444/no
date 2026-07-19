import { AiUnavailableError, summarizeChapter } from "@/lib/ai";
import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import {
  getChapter,
  listCharacters,
  updateChapter,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 본문 요약 자동 생성 + 새 사건 추출 (기획안 §6 출력 후 처리)
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 회차 ID");
  const chapter = getChapter(id);
  if (!chapter) return notFound("회차를 찾을 수 없습니다");

  let body: { currentBody?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const text = (body.currentBody ?? chapter.body).trim();
  if (text.length < 20) return badRequest("요약할 본문이 너무 짧습니다");

  try {
    const result = await summarizeChapter({
      chapterNumber: chapter.number,
      body: text,
      characterNames: listCharacters(chapter.work_id).map((c) => c.name),
    });
    // 요약은 즉시 저장 (다음 회차 컨텍스트로 사용)
    updateChapter(id, { summary: result.summary });
    return json(result);
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest(err.message);
    if (err instanceof SyntaxError)
      return serverError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
    return serverError(err instanceof Error ? err.message : "요약 실패");
  }
}
