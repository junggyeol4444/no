import { badRequest, json, parseId, serverError } from "@/lib/http";
import { createPlotPoint, getWork, listPlotPoints } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  return json(listPlotPoints(workId));
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
    return json(createPlotPoint(workId, body), 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "비트 생성 실패");
  }
}
