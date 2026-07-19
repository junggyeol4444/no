import ChapterList from "@/components/ChapterList";
import { parseId } from "@/lib/http";
import { getWork, listChapters } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function ChaptersPage({
  params,
}: {
  params: { workId: string };
}) {
  const workId = parseId(params.workId)!;
  const work = getWork(workId)!;
  const chapters = listChapters(workId);
  return (
    <ChapterList
      workId={workId}
      defaultLength={work.default_length}
      initial={chapters}
    />
  );
}
