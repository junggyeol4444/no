import Link from "next/link";
import { listPublishedChapters, listPublishedWorks } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata = { title: "연재 작품 — WebNovel Studio" };

export default function ReadIndex() {
  const works = listPublishedWorks();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-serif text-2xl font-semibold">연재 작품</h1>
      {works.length === 0 ? (
        <div className="card text-center text-sm text-ink-400">
          아직 발행된 작품이 없습니다. (작가가 회차를 “발행”하면 여기에 표시됩니다)
        </div>
      ) : (
        <div className="space-y-3">
          {works.map((w) => {
            const n = listPublishedChapters(w.id).length;
            return (
              <Link
                key={w.id}
                href={`/read/${w.id}`}
                className="card block transition-colors hover:border-amber-500/60"
              >
                <h2 className="font-serif text-lg font-semibold text-ink-100">
                  {w.title}
                </h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {w.genre && <span className="chip">{w.genre}</span>}
                  {w.tone && <span className="chip">{w.tone}</span>}
                </div>
                {w.synopsis && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-400">
                    {w.synopsis}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-500">{n}화 연재 중</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
