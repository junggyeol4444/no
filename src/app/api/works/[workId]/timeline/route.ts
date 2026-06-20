import { badRequest, json, parseId, serverError } from "@/lib/http";
import { createTimelineEvent, getWork, listTimeline } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  return json(listTimeline(workId));
}

export async function POST(
  req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  if (!getWork(workId)) return badRequest("작품이 존재하지 않습니다");
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.description || !String(body.description).trim()) {
      return badRequest("사건 내용이 필요합니다");
    }
    return json(createTimelineEvent(workId, body), 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "사건 기록 실패");
  }
}
