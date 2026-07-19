import { badRequest, json, parseId } from "@/lib/http";
import { deleteTimelineEvent } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  deleteTimelineEvent(id);
  return json({ ok: true });
}
