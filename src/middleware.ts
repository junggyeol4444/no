import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authToken } from "@/lib/authToken";

// APP_PASSWORD 가 설정된 경우에만 활성화되는 단순 접근 차단.
// 미설정이면 완전히 투명하게 통과 (로컬 단일 사용자 기본값).
export function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("app_auth")?.value;
  if (cookie === authToken(pw)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
