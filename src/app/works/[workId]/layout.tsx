import Link from "next/link";
import { notFound } from "next/navigation";
import WorkSidebar from "@/components/WorkSidebar";
import { parseId } from "@/lib/http";
import { getWork } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function WorkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workId: string };
}) {
  const id = parseId(params.workId);
  const work = id ? getWork(id) : undefined;

  if (!work) {
    return (
      <div className="card text-center">
        <p className="text-ink-300">작품을 찾을 수 없습니다.</p>
        <Link href="/" className="mt-2 inline-block text-amber-400">
          ← 작품 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <WorkSidebar workId={work.id} title={work.title} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
