import {
  assertProviderReady,
  generateChapterStream,
  AiUnavailableError,
  type WriteMode,
} from "@/lib/ai";
import { badRequest, notFound, parseId, serverError } from "@/lib/http";
import {
  getChapter,
  getPreviousChapter,
  getWork,
  listCharacters,
  listTimeline,
  listWorldSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** CSV id 목록으로 선별. 비어 있으면 전체 (기획안 §6 등장인물 선별) */
function pickByIds<T extends { id: number }>(items: T[], csv: string): T[] {
  const ids = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return items;
  const set = new Set(ids);
  return items.filter((i) => set.has(i.id));
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (!id) return badRequest("잘못된 회차 ID");
  const chapter = getChapter(id);
  if (!chapter) return notFound("회차를 찾을 수 없습니다");
  const work = getWork(chapter.work_id);
  if (!work) return notFound("작품을 찾을 수 없습니다");

  let body: { mode?: string; condition?: string; currentBody?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode: WriteMode =
    body.mode === "continue"
      ? "continue"
      : body.mode === "regenerate"
        ? "regenerate"
        : "auto";

  // 스트림 시작 후에는 상태코드를 못 바꾸므로, 사용 가능 여부를 미리 점검
  try {
    await assertProviderReady();
  } catch (err) {
    if (err instanceof AiUnavailableError) return badRequest(err.message);
    return serverError(err instanceof Error ? err.message : "점검 실패");
  }

  const gen = generateChapterStream({
    work,
    characters: pickByIds(
      listCharacters(work.id),
      chapter.included_character_ids,
    ),
    worldSettings: pickByIds(
      listWorldSettings(work.id),
      chapter.included_world_ids,
    ),
    prevChapter: getPreviousChapter(work.id, chapter.number) ?? null,
    timeline: listTimeline(work.id),
    chapter: { number: chapter.number, beat: chapter.beat },
    condition: body.condition?.trim() || undefined,
    mode,
    currentBody: body.currentBody ?? chapter.body,
    targetLength: work.default_length,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of gen) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "생성 오류";
        controller.enqueue(encoder.encode(`\n\n[⚠️ 생성 중단: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
