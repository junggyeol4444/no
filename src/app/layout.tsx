import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
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
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
