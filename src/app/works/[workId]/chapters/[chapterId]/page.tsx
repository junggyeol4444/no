import Link from "next/link";
import ChapterEditor from "@/components/ChapterEditor";
import { getActiveAiInfo } from "@/lib/ai";
import { parseId } from "@/lib/http";
import {
  getChapter,
  getPreviousChapter,
  getWork,
  listCharacters,
  listWorldSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function ChapterEditorPage({
  params,
}: {
  params: { workId: string; chapterId: string };
}) {
  const workId = parseId(params.workId);
  const chapterId = parseId(params.chapterId);
  const chapter = chapterId ? getChapter(chapterId) : undefined;
  const work = workId ? getWork(workId) : undefined;

  if (!work || !chapter || chapter.work_id !== work.id) {
    return (
      <div className="card text-center text-sm text-ink-400">
        회차를 찾을 수 없습니다.{" "}
        <Link href={`/works/${params.workId}/chapters`} className="text-amber-400">
          회차 목록으로
        </Link>
      </div>
    );
  }

  const prev = getPreviousChapter(work.id, chapter.number);

  return (
    <ChapterEditor
      work={{
        id: work.id,
        title: work.title,
        genre: work.genre,
        tone: work.tone,
        default_length: work.default_length,
        persistent_conditions: work.persistent_conditions,
      }}
      chapter={chapter}
      characters={listCharacters(work.id)}
      worldSettings={listWorldSettings(work.id)}
      prevChapter={prev ? { number: prev.number, summary: prev.summary } : null}
      ai={getActiveAiInfo()}
    />
  );
}
