import { badRequest, json, serverError } from "@/lib/http";
import { createWork, listWorks } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET() {
  return json(listWorks());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body.title !== "string" || !body.title.trim()) {
      return badRequest("작품 제목이 필요합니다");
    }
    const work = createWork(body);
    return json(work, 201);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "작품 생성 실패");
  }
}
