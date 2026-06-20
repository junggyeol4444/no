import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import { deleteChapter, getChapter, updateChapter } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  const ch = getChapter(id);
  return ch ? json(ch) : notFound("회차를 찾을 수 없습니다");
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  try {
    const body = await req.json();
    const updated = updateChapter(id, body);
    return updated ? json(updated) : notFound("회차를 찾을 수 없습니다");
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "회차 수정 실패");
  }
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  deleteChapter(id);
  return json({ ok: true });
}
