import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import { deleteWork, getWork, updateWork } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: { workId: string } }) {
  const id = parseId(params.workId);
  if (!id) return badRequest("잘못된 작품 ID");
  const work = getWork(id);
  return work ? json(work) : notFound("작품을 찾을 수 없습니다");
}

export async function PATCH(
  req: Request,
  { params }: { params: { workId: string } },
) {
  const id = parseId(params.workId);
  if (!id) return badRequest("잘못된 작품 ID");
  try {
    const body = await req.json();
    const work = updateWork(id, body);
    return work ? json(work) : notFound("작품을 찾을 수 없습니다");
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "작품 수정 실패");
  }
}

export function DELETE(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const id = parseId(params.workId);
  if (!id) return badRequest("잘못된 작품 ID");
  deleteWork(id);
  return json({ ok: true });
}
