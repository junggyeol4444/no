import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import { deleteCharacter, updateCharacter } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  try {
    const body = await req.json();
    const updated = updateCharacter(id, body);
    return updated ? json(updated) : notFound("캐릭터를 찾을 수 없습니다");
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "캐릭터 수정 실패");
  }
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  deleteCharacter(id);
  return json({ ok: true });
}
