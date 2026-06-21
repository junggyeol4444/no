import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebNovel Studio",
  description:
    "AI가 회차를 자동 집필하되, 작가가 설정·플롯을 직접 관리하며 일관성을 유지하는 웹소설 연재 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg">✒️</span>
              <span className="font-serif text-lg font-semibold tracking-tight">
                WebNovel Studio
              </span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">AI 설정</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
