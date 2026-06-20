import { badRequest, json, parseId, serverError } from "@/lib/http";
import { createCharacter, createWorldSetting, getWork } from "@/lib/repo";
import type { AnalyzedCharacter, AnalyzedWorldSetting } from "@/lib/types";

export const dynamic = "force-dynamic";

// 자동 분석 결과 중 작가가 채택한 항목을 일괄 저장 (기획안 §2-1-A 검수 후 저장)
export async function POST(
  req: Request,
  { params }: { params: { workId: string } },
) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  if (!getWork(workId)) return badRequest("작품이 존재하지 않습니다");

  try {
    const body = (await req.json()) as {
      target?: string;
      characters?: AnalyzedCharacter[];
      world_settings?: AnalyzedWorldSetting[];
    };

    let created = 0;
    if (Array.isArray(body.characters)) {
      for (const c of body.characters) {
        createCharacter(workId, c);
        created++;
      }
    }
    if (Array.isArray(body.world_settings)) {
      for (const w of body.world_settings) {
        createWorldSetting(workId, w);
        created++;
      }
    }
    return json({ ok: true, created });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "저장 실패");
  }
}
