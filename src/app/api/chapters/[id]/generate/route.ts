import {
  generateChapter,
  MissingApiKeyError,
  type WriteMode,
} from "@/lib/anthropic";
import { badRequest, json, notFound, parseId, serverError } from "@/lib/http";
import {
  getChapter,
  getPreviousChapter,
  getWork,
  listCharacters,
  listTimeline,
  listWorldSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const text = await generateChapter({
      work,
      characters: listCharacters(work.id),
      worldSettings: listWorldSettings(work.id),
      prevChapter: getPreviousChapter(work.id, chapter.number) ?? null,
      timeline: listTimeline(work.id),
      chapter: { number: chapter.number, beat: chapter.beat },
      condition: body.condition?.trim() || undefined,
      mode,
      currentBody: body.currentBody ?? chapter.body,
      targetLength: work.default_length,
    });
    return json({ text });
  } catch (err) {
    if (err instanceof MissingApiKeyError) return badRequest(err.message);
    return serverError(err instanceof Error ? err.message : "집필 실패");
  }
}
