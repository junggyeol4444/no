import { analyzeSettings, MissingApiKeyError } from "@/lib/anthropic";
import { badRequest, json, parseId, serverError } from "@/lib/http";
import { getWork } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  if (!getWork(workId)) return badRequest("작품이 존재하지 않습니다");

  let body: { text?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 본문이 올바르지 않습니다");
  }

  const text = (body.text ?? "").trim();
  const target = body.target === "world" ? "world" : "characters";
  if (text.length < 5) return badRequest("분석할 텍스트가 너무 짧습니다");

  try {
    const result = await analyzeSettings(text, target);
    return json(result);
  } catch (err) {
    if (err instanceof MissingApiKeyError) return badRequest(err.message);
    if (err instanceof SyntaxError)
      return serverError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
    return serverError(err instanceof Error ? err.message : "분석 실패");
  }
}
