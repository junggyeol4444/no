"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  // 공개 독자 사이트와 로그인 화면에서는 작가용 헤더를 숨김
  if (pathname.startsWith("/read") || pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg">✒️</span>
          <span className="font-serif text-lg font-semibold tracking-tight">
            WebNovel Studio
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/read"
            className="rounded-md px-2 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            📖 독자 사이트
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">AI 설정</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
