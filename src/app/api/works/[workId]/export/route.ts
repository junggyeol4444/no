import { badRequest, notFound, parseId } from "@/lib/http";
import { getWork, listChapters } from "@/lib/repo";

export const dynamic = "force-dynamic";

// 작품 전체를 한 파일로 내보내기 (기획안 §2-4 확장). ?format=txt|md
export function GET(req: Request, { params }: { params: { workId: string } }) {
  const workId = parseId(params.workId);
  if (!workId) return badRequest("잘못된 작품 ID");
  const work = getWork(workId);
  if (!work) return notFound("작품을 찾을 수 없습니다");

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "md" ? "md" : "txt";
  const chapters = listChapters(workId);

  let content: string;
  if (format === "md") {
    content =
      `# ${work.title}\n\n` +
      (work.synopsis ? `> ${work.synopsis}\n\n` : "") +
      chapters
        .map(
          (c) =>
            `## ${c.number}화${c.title ? ` - ${c.title}` : ""}\n\n${c.body}\n`,
        )
        .join("\n");
  } else {
    content =
      `${work.title}\n\n` +
      chapters
        .map(
          (c) =>
            `${c.number}화${c.title ? ` - ${c.title}` : ""}\n\n${c.body}\n`,
        )
        .join("\n──────────\n\n");
  }

  const safeTitle = (work.title || "webnovel").replace(
    /[^\p{L}\p{N}._-]+/gu,
    "_",
  );
  const filename = `${safeTitle}_전체.${format}`;

  return new Response(content, {
    headers: {
      "Content-Type": `text/${format === "md" ? "markdown" : "plain"}; charset=utf-8`,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
