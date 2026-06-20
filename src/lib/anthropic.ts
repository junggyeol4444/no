import Anthropic from "@anthropic-ai/sdk";
import type {
  AnalysisResult,
  Chapter,
  Character,
  TimelineEvent,
  WorldSetting,
  Work,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Anthropic Claude API 연동 (기획안 §4, §6).
// 본문 생성용 모델은 Sonnet 계열을 기본값으로 사용 (환경변수로 override 가능).
// ─────────────────────────────────────────────────────────────────────────

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY 가 설정되지 않았습니다. 프로젝트 루트의 .env.local 에 키를 추가하세요.",
    );
    this.name = "MissingApiKeyError";
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (!client) client = new Anthropic();
  return client;
}

/** 응답에서 text 블록만 이어붙여 반환 */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** 모델 응답 문자열에서 JSON 오브젝트를 관대하게 추출 (코드펜스/잡설 제거) */
function extractJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}

/** 기본 메시지 호출 헬퍼 */
export async function callModel(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return textOf(message);
}

// ─────────────────────────── 설정 자동 분석 (§2-1-A) ─────────────────────────

const CHARACTER_SCHEMA_HINT = `{
  "characters": [
    {
      "name": "이름",
      "appearance": "외형 묘사",
      "personality": "성격",
      "speech_style": "말투 특징",
      "goal": "목표/동기",
      "relationships": "다른 인물과의 관계",
      "secrets": "비밀 설정",
      "notes": "기타 메모"
    }
  ],
  "world_settings": [],
  "suggestions": ["누락되었거나 모호한 설정에 대한 보완 질문/제안"]
}`;

const WORLD_SCHEMA_HINT = `{
  "characters": [],
  "world_settings": [
    {
      "category": "시대/배경 | 규칙/시스템 | 지명 | 세력 | 용어 | 기타 중 하나",
      "title": "항목 제목",
      "content": "항목 상세 내용"
    }
  ],
  "suggestions": ["누락되었거나 모호한 설정에 대한 보완 질문/제안"]
}`;

export async function analyzeSettings(
  rawText: string,
  target: "characters" | "world",
): Promise<AnalysisResult> {
  const schema = target === "characters" ? CHARACTER_SCHEMA_HINT : WORLD_SCHEMA_HINT;
  const focus =
    target === "characters"
      ? "작가가 붙여넣은 텍스트에서 '등장인물' 정보를 추출해 캐릭터 카드 필드로 정리하세요. 인물이 여러 명이면 각각 분리하세요."
      : "작가가 붙여넣은 텍스트에서 '세계관/설정' 정보를 추출해 카테고리별 항목으로 정리하세요. 하나의 큰 글이라도 의미 단위로 여러 항목으로 분리하세요.";

  const system = `당신은 웹소설 설정 정리 보조자입니다. ${focus}

규칙:
- 텍스트에 실제로 적힌 내용만 사용하고, 사실을 지어내지 마세요.
- 명시되지 않은 필드는 빈 문자열("")로 두세요.
- 누락되었거나 모호해서 작가의 확인이 필요한 부분은 "suggestions" 배열에 한국어 질문/제안으로 담으세요.
- 반드시 아래 스키마와 동일한 형태의 JSON '하나만' 출력하세요. 마크다운, 설명, 코드펜스 없이 순수 JSON만 출력합니다.

스키마:
${schema}`;

  const out = await callModel({
    system,
    user: rawText,
    maxTokens: 4000,
  });

  const parsed = extractJson<Partial<AnalysisResult>>(out);
  return {
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    world_settings: Array.isArray(parsed.world_settings)
      ? parsed.world_settings
      : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
  };
}

// ─────────────────────── 일관성/모순 점검 (§2-2 AI 검수) ─────────────────────

export async function checkConsistency(input: {
  characters: { name: string; secrets: string; goal: string }[];
  worldSettings: { category: string; title: string; content: string }[];
  timeline: { description: string; involved_characters: string }[];
  chapters: { number: number; title: string; summary: string }[];
}): Promise<{ warnings: string[] }> {
  const parts: string[] = [];
  parts.push(
    "## 캐릭터\n" +
      (input.characters
        .map((c) => `- ${c.name}: 목표=${c.goal || "-"} / 비밀=${c.secrets || "-"}`)
        .join("\n") || "없음"),
  );
  parts.push(
    "## 세계관 규칙/설정\n" +
      (input.worldSettings
        .map((w) => `- [${w.category}] ${w.title}: ${w.content}`)
        .join("\n") || "없음"),
  );
  parts.push(
    "## 타임라인 (이미 일어난 일)\n" +
      (input.timeline
        .map(
          (t, i) =>
            `${i + 1}. ${t.description}${t.involved_characters ? ` (관련: ${t.involved_characters})` : ""}`,
        )
        .join("\n") || "없음"),
  );
  parts.push(
    "## 회차 요약\n" +
      (input.chapters
        .map((c) => `${c.number}화 ${c.title}: ${c.summary || "(요약 없음)"}`)
        .join("\n") || "없음"),
  );

  const system = `당신은 웹소설 연재의 설정 감수자입니다. 아래 자료에서 '명백한 모순'만 찾아 경고하세요.
예: 죽은 인물이 이후 등장, 세계관 규칙 위반, 시점 모순, 이미 밝혀진 비밀이 다시 비밀로 취급됨 등.
주의:
- 단순한 빈약함이나 취향 문제는 경고하지 마세요. 확실한 모순만.
- 모순이 없으면 빈 배열을 반환하세요.
- 반드시 다음 JSON 하나만 출력: {"warnings": ["모순 설명 (관련 항목 포함)"]}`;

  const out = await callModel({
    system,
    user: parts.join("\n\n"),
    maxTokens: 2000,
  });
  const parsed = extractJson<{ warnings?: string[] }>(out);
  return { warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [] };
}

// ─────────────────────── 회차 자동 집필 (§2-3, §6) ─────────────────────────

export type WriteMode = "auto" | "continue" | "regenerate";

export interface ChapterGenInput {
  work: Work;
  characters: Character[];
  worldSettings: WorldSetting[];
  prevChapter?: Pick<Chapter, "number" | "summary"> | null;
  timeline: TimelineEvent[];
  chapter: Pick<Chapter, "number" | "beat">;
  /** 이번 회차 일회성 자연어 조건 */
  condition?: string;
  mode: WriteMode;
  /** 이어쓰기/재생성 시 현재 본문 */
  currentBody?: string;
  targetLength: number;
}

/** §6 의 프롬프트 컨텍스트를 조립 */
function buildChapterContext(input: ChapterGenInput): string {
  const { work, characters, worldSettings, prevChapter, timeline, chapter } =
    input;
  const blocks: string[] = [];

  blocks.push(
    `# 작품 정보
제목: ${work.title}
장르: ${work.genre || "-"}
톤/문체: ${work.tone || "-"}
시놉시스: ${work.synopsis || "-"}
지속 집필 조건: ${work.persistent_conditions || "없음"}`,
  );

  if (characters.length) {
    blocks.push(
      "# 등장인물\n" +
        characters
          .map(
            (c) =>
              `- ${c.name}\n  · 외형: ${c.appearance || "-"}\n  · 성격: ${c.personality || "-"}\n  · 말투: ${c.speech_style || "-"}\n  · 목표: ${c.goal || "-"}\n  · 관계: ${c.relationships || "-"}\n  · 비밀: ${c.secrets || "-"}`,
          )
          .join("\n"),
    );
  }

  if (worldSettings.length) {
    blocks.push(
      "# 세계관 설정\n" +
        worldSettings
          .map((w) => `- [${w.category}] ${w.title}: ${w.content}`)
          .join("\n"),
    );
  }

  const story: string[] = [];
  if (prevChapter?.summary) {
    story.push(`직전 ${prevChapter.number}화 요약: ${prevChapter.summary}`);
  }
  if (timeline.length) {
    story.push(
      "지금까지의 타임라인:\n" +
        timeline.map((t, i) => `${i + 1}. ${t.description}`).join("\n"),
    );
  }
  if (story.length) blocks.push("# 지금까지의 줄거리\n" + story.join("\n\n"));

  blocks.push(
    `# 이번 회차 (${chapter.number}화)
목표 사건(beat): ${chapter.beat || "(미지정 — 자연스러운 전개로)"}
${input.condition ? `이번 회차 조건(일회성): ${input.condition}\n` : ""}목표 분량: 약 ${input.targetLength}자 (공백 제외)`,
  );

  return blocks.join("\n\n");
}

export async function generateChapter(input: ChapterGenInput): Promise<string> {
  const context = buildChapterContext(input);

  const system = `당신은 한국어 웹소설 작가입니다. 주어진 작품 정보·등장인물·세계관·플롯·맥락을 '제약 조건'으로 삼아, 그 안에서만 회차 본문을 집필합니다.

집필 규칙:
- 설정·세계관 규칙·이미 일어난 일과 모순되지 않게 쓰세요.
- 지정된 톤/문체와 조건을 지키세요.
- 목표 분량에 근접하도록 쓰되, 자연스러움을 우선하세요.
- 메타 설명, 머리말, 해설 없이 '소설 본문'만 출력하세요.`;

  let instruction: string;
  if (input.mode === "continue") {
    instruction = `아래는 지금까지 작성된 ${input.chapter.number}화 본문입니다. 이미 쓰인 내용은 다시 출력하지 말고, 자연스럽게 '이어지는 새 본문만' 출력하세요.

[지금까지의 본문]
${input.currentBody || ""}`;
  } else {
    instruction = `위 정보를 바탕으로 ${input.chapter.number}화 본문을 처음부터 집필하세요.`;
  }

  return callModel({
    system,
    user: `${context}\n\n---\n\n${instruction}`,
    maxTokens: 8000,
  });
}

// ───────────── 회차 요약 + 새 사건 추출 (§6 출력 후 처리) ─────────────────

export interface SummarizeResult {
  summary: string;
  timeline_suggestions: { description: string; involved_characters: string }[];
}

export async function summarizeChapter(input: {
  chapterNumber: number;
  body: string;
  characterNames: string[];
}): Promise<SummarizeResult> {
  const system = `당신은 웹소설 편집자입니다. 주어진 회차 본문을 분석해 두 가지를 JSON으로 반환하세요.
1) summary: 다음 회차 집필에 필요한 핵심만 담은 간결한 요약 (3~5문장, 한국어).
2) timeline_suggestions: 이 회차에서 '새로 일어난 주요 사건' 목록. 각 항목은 description(사건 한 줄)과 involved_characters(관련 인물, 쉼표 구분).

반드시 다음 JSON 하나만 출력하세요(마크다운/설명 없이):
{"summary":"...","timeline_suggestions":[{"description":"...","involved_characters":"..."}]}`;

  const out = await callModel({
    system,
    user: `참고 등장인물: ${input.characterNames.join(", ") || "없음"}\n\n[${input.chapterNumber}화 본문]\n${input.body}`,
    maxTokens: 1500,
  });

  const parsed = extractJson<Partial<SummarizeResult>>(out);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    timeline_suggestions: Array.isArray(parsed.timeline_suggestions)
      ? parsed.timeline_suggestions
      : [],
  };
}
