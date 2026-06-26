import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import { readerBase, sendToTarget } from "@/lib/publish";
import {
  getChapter,
  getWork,
  listPublishTargets,
  setChapterPublished,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

// 회차 발행/비공개 토글 + 발행 시 자동 업로드 대상으로 전송
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 회차 ID");
  const chapter = getChapter(id);
  if (!chapter) return notFound("회차를 찾을 수 없습니다");

  let body: { published?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const publish = body.published !== false;

  try {
    const updated = setChapterPublished(id, publish);
    if (!updated) return notFound("회차를 찾을 수 없습니다");

    const sent: { label: string; ok: boolean; error?: string }[] = [];
    if (publish) {
      const work = getWork(chapter.work_id);
      const targets = listPublishTargets(chapter.work_id).filter(
        (t) => t.enabled === 1 && t.url,
      );
      if (targets.length) {
        const base = readerBase(req);
        const payload = {
          workTitle: work?.title ?? "",
          number: chapter.number,
          title: chapter.title,
          body: chapter.body,
          readerUrl: `${base}/read/${chapter.work_id}/${chapter.number}`,
        };
        const results = await Promise.all(
          targets.map(async (t) => ({
            label: t.label || t.type,
            ...(await sendToTarget(t, payload)),
          })),
        );
        sent.push(...results);
      }
    }
    return json({ chapter: updated, sent });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "발행 실패");
  }
}
