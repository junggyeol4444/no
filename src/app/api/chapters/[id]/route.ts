import {
  badRequest,
  conflict,
  json,
  notFound,
  parseId,
  serverError,
} from "@/lib/http";
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
    const { expected_updated_at, ...patch } = body;

    // 낙관적 락: 다른 탭/창에서 먼저 수정됐는지 확인
    if (expected_updated_at) {
      const cur = getChapter(id);
      if (cur && cur.updated_at !== expected_updated_at) {
        return conflict(
          "이 회차가 다른 곳에서 수정되었습니다. 새로고침 후 다시 저장하세요.",
          cur,
        );
      }
    }

    const updated = updateChapter(id, patch);
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
