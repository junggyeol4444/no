"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "chapters", label: "회차 목록", icon: "📑" },
  { slug: "characters", label: "캐릭터 관리", icon: "👤" },
  { slug: "world", label: "세계관/설정집", icon: "🗺️" },
  { slug: "plot", label: "플롯/타임라인", icon: "🧭" },
  { slug: "settings", label: "작품 설정", icon: "⚙️" },
];

export default function WorkSidebar({
  workId,
  title,
}: {
  workId: number;
  title: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 md:w-56">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200"
      >
        ← 작품 목록
      </Link>
      <h2 className="mb-4 line-clamp-2 font-serif text-lg font-semibold">
        {title}
      </h2>
      <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {TABS.map((tab) => {
          const href = `/works/${workId}/${tab.slug}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.slug}
              href={href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-amber-500/15 font-semibold text-amber-400"
                  : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
