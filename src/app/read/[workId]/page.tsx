import Link from "next/link";
import { parseId } from "@/lib/http";
import { getWork, listPublishedChapters } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function ReadWork({ params }: { params: { workId: string } }) {
  const workId = parseId(params.workId);
  const work = workId ? getWork(workId) : undefined;
  const chapters = workId ? listPublishedChapters(workId) : [];

  if (!work || chapters.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card text-center text-sm text-ink-400">
          발행된 회차가 없습니다.{" "}
          <Link href="/read" className="text-amber-400">
            ← 작품 목록
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/read" className="text-xs text-ink-500 hover:text-ink-300">
        ← 작품 목록
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-semibold">{work.title}</h1>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {work.genre && <span className="chip">{work.genre}</span>}
        {work.tone && <span className="chip">{work.tone}</span>}
      </div>
      {work.synopsis && (
        <p className="mt-3 text-sm leading-7 text-ink-300">{work.synopsis}</p>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-400">
        목차 ({chapters.length}화)
      </h2>
      <ol className="divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-800">
        {chapters.map((c) => (
          <li key={c.id}>
            <Link
              href={`/read/${work.id}/${c.number}`}
              className="flex items-center justify-between gap-3 bg-ink-900 px-4 py-3 hover:bg-ink-800"
            >
              <span>
                <b className="text-ink-300">{c.number}화</b>{" "}
                <span className="text-ink-100">{c.title || ""}</span>
              </span>
              <span className="text-xs text-ink-500">
                {c.word_count.toLocaleString()}자
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
