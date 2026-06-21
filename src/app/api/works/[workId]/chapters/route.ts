import { badRequest, json, parseId, serverError } from "@/lib/http";
import {
  createChapter,
  getWork,
  insertChapterAfter,
  listChapters,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  return json(listChapters(workId));
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
    // { after: N } 이면 N화 다음에 끼워넣고 이후 번호를 민다
    if (Number.isInteger(body.after) && body.after > 0) {
      return json(insertChapterAfter(workId, body.after), 201);
    }
    return json(createChapter(workId, body), 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "회차 생성 실패");
  }
}
