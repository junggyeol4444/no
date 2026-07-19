import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "찾을 수 없습니다") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function conflict(message: string, current?: unknown) {
  return NextResponse.json(
    { error: message, conflict: true, ...(current ? { current } : {}) },
    { status: 409 },
  );
}

/** 경로 파라미터를 정수로 파싱. 실패 시 null. */
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
