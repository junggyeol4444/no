import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import { deletePlotPoint, updatePlotPoint } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  try {
    const body = await req.json();
    const updated = updatePlotPoint(id, body);
    return updated ? json(updated) : notFound("비트를 찾을 수 없습니다");
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "비트 수정 실패");
  }
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  deletePlotPoint(id);
  return json({ ok: true });
}
