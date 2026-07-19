import Link from "next/link";
import type { Metadata } from "next";
import { parseId } from "@/lib/http";
import { getPublishedChapter, getWork, listPublishedChapters } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { workId: string; number: string };
}): Metadata {
  const workId = parseId(params.workId);
  const work = workId ? getWork(workId) : undefined;
  return {
    title: work ? `${work.title} ${params.number}화` : "읽기",
  };
}

export default function ReadChapter({
  params,
}: {
  params: { workId: string; number: string };
}) {
  const workId = parseId(params.workId);
  const number = Number(params.number);
  const work = workId ? getWork(workId) : undefined;
  const chapter =
    workId && Number.isInteger(number)
      ? getPublishedChapter(workId, number)
      : undefined;

  if (!work || !chapter) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card text-center text-sm text-ink-400">
          회차를 찾을 수 없습니다.{" "}
          <Link href="/read" className="text-amber-400">
            ← 작품 목록
          </Link>
        </div>
      </div>
    );
  }

  const all = listPublishedChapters(workId!);
  const idx = all.findIndex((c) => c.number === number);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-xs text-ink-500">
        <Link href={`/read/${work.id}`} className="hover:text-ink-300">
          ☰ {work.title}
        </Link>
        <span>{chapter.number}화</span>
      </div>

      <h1 className="mb-6 font-serif text-2xl font-semibold">
        {chapter.number}화{chapter.title ? ` ${chapter.title}` : ""}
      </h1>

      <div className="prose-novel whitespace-pre-wrap text-[16px] leading-9">
        {chapter.body || "(본문이 비어 있습니다)"}
      </div>

      <nav className="mt-10 flex items-center justify-between border-t border-ink-800 pt-4 text-sm">
        {prev ? (
          <Link
            href={`/read/${work.id}/${prev.number}`}
            className="btn-secondary"
          >
            ← {prev.number}화
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/read/${work.id}`} className="btn-ghost">
          목차
        </Link>
        {next ? (
          <Link
            href={`/read/${work.id}/${next.number}`}
            className="btn-secondary"
          >
            {next.number}화 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
