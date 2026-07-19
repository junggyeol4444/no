import { badRequest, json, parseId, serverError } from "@/lib/http";
import { createWorldSetting, getWork, listWorldSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  return json(listWorldSettings(workId));
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
    return json(createWorldSetting(workId, body), 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "설정 생성 실패");
  }
}
