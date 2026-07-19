import { badRequest, json, notFound, parseId } from "@/lib/http";
import { readerBase, sendToTarget } from "@/lib/publish";
import { getPublishTarget, getWork } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 발행 대상으로 테스트 메시지 전송
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 ID");
  const target = getPublishTarget(id);
  if (!target) return notFound("대상을 찾을 수 없습니다");
  const work = getWork(target.work_id);
  const base = readerBase(req);

  const result = await sendToTarget(target, {
    workTitle: work?.title ?? "테스트 작품",
    number: 0,
    title: "(테스트 전송)",
    body: "WebNovel Studio 발행 대상 연결 테스트입니다. 이 메시지가 보이면 연동이 정상입니다.",
    readerUrl: `${base}/read/${target.work_id}`,
  });
  return json(result);
}
