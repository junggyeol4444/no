import Link from "next/link";
import NewWorkButton from "@/components/NewWorkButton";
import { chapterStats, listWorks } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const works = listWorks();

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">내 작품</h1>
          <p className="mt-1 text-sm text-ink-400">
            설정·플롯이라는 제약 안에서 AI가 회차를 집필합니다.
          </p>
        </div>
        <NewWorkButton />
      </div>

      {works.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl">📚</p>
          <p className="mt-3 text-ink-300">아직 작품이 없습니다.</p>
          <p className="text-sm text-ink-500">
            “새 작품”으로 첫 작품을 만들어 보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => {
            const stats = chapterStats(work.id);
            return (
              <Link
                key={work.id}
                href={`/works/${work.id}/chapters`}
                className="card group transition-colors hover:border-amber-500/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg font-semibold text-ink-100 group-hover:text-amber-400">
                    {work.title}
                  </h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {work.genre && <span className="chip">{work.genre}</span>}
                  {work.tone && <span className="chip">{work.tone}</span>}
                </div>
                {work.synopsis && (
                  <p className="mt-3 line-clamp-3 text-sm text-ink-400">
                    {work.synopsis}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 border-t border-ink-800 pt-3 text-xs text-ink-400">
                  <span>
                    회차 <b className="text-ink-200">{stats.total}</b>
                  </span>
                  <span>
                    완료 <b className="text-ink-200">{stats.done}</b>
                  </span>
                  <span>
                    {stats.words.toLocaleString()}자
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
