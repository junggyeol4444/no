import type { PublishTarget } from "./types";

// 자동 업로드 대상 전송 (웹훅 / 디스코드 웹훅).
// 주의: 문피아·네이버·카카오 등 국내 웹소설 플랫폼은 작가용 공개 업로드 API가
// 없으므로 직접 자동 게시는 불가합니다. 대신 사용자가 제어하는 엔드포인트
// (자체 서버·Zapier/Make·n8n·Discord 등)로 보내 거기서 연동하는 방식입니다.

export interface PublishPayload {
  workTitle: string;
  number: number;
  title: string;
  body: string;
  readerUrl: string;
}

export async function sendToTarget(
  target: PublishTarget,
  payload: PublishPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!target.url) return { ok: false, error: "URL이 비어 있습니다" };
  try {
    if (target.type === "discord") {
      const heading = `**${payload.workTitle} — ${payload.number}화${payload.title ? ` ${payload.title}` : ""}**`;
      const link = payload.readerUrl ? `\n${payload.readerUrl}` : "";
      const room = 1900 - heading.length - link.length;
      const excerpt = payload.body.slice(0, Math.max(0, room));
      const more = payload.body.length > excerpt.length ? "…" : "";
      const res = await fetch(target.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `${heading}${link}\n\n${excerpt}${more}` }),
      });
      if (!res.ok) return { ok: false, error: `Discord ${res.status}` };
      return { ok: true };
    }
    // webhook: 전체 페이로드를 JSON 으로
    const res = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `웹훅 ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "전송 실패" };
  }
}

export function readerBase(req: Request): string {
  return process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
}
