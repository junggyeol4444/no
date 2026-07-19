import { badRequest, notFound, parseId } from "@/lib/http";
import { getChapter, getWork } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 회차 본문 txt 내보내기 (기획안 §2-4)
export function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  const ch = getChapter(id);
  if (!ch) return notFound("회차를 찾을 수 없습니다");
  const work = getWork(ch.work_id);

  const heading = `${ch.number}화${ch.title ? ` - ${ch.title}` : ""}`;
  const content = `${heading}\n\n${ch.body}\n`;

  const safeTitle = (work?.title || "webnovel").replace(/[^\p{L}\p{N}._-]+/gu, "_");
  const filename = `${safeTitle}_${ch.number}화.txt`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
