import Anthropic from "@anthropic-ai/sdk";
import { getAiSettings } from "./repo";
import type {
  AnalysisResult,
  Chapter,
  Character,
  TimelineEvent,
  WorldSetting,
  Work,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// AI 공급자 추상화 (기획안 §4, §6).
//   - 기본: 로컬 LLM (Ollama) — API 키·인터넷 불필요
//   - 옵션: Anthropic Claude 클라우드
// 공급자/모델은 DB 설정(화면에서 변경) → 환경변수 → 기본값 순으로 결정됩니다.
// 모든 AI 호출은 callModel()/streamModel() 한 곳을 거칩니다.
// ─────────────────────────────────────────────────────────────────────────

export type Provider = "ollama" | "anthropic";

interface AiConfig {
  provider: Provider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  anthropicModel: string;
}

function cfg(): AiConfig {
  const s = getAiSettings();
  return {
    provider: s.provider === "anthropic" ? "anthropic" : "ollama",
    ollamaBaseUrl: s.ollamaBaseUrl,
    ollamaModel: s.ollamaModel,
    anthropicModel: s.anthropicModel,
  };
}

/** 화면 표시용 현재 AI 정보 */
export function getActiveAiInfo(): { provider: Provider; model: string } {
  const c = cfg();
  return {
    provider: c.provider,
    model: c.provider === "anthropic" ? c.anthropicModel : c.ollamaModel,
  };
}

/** 키 미설정 / Ollama 미실행·모델 없음 등 "AI를 쓸 수 없는" 상태 (사용자 안내용) */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

interface CallOpts {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
}

// ───────────────────────────── Ollama ────────────────────────────────────

function ollamaBody(c: AiConfig, opts: CallOpts, stream: boolean) {
  return JSON.stringify({
    model: c.ollamaModel,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    stream,
    ...(opts.json ? { format: "json" } : {}),
    options: { num_predict: opts.maxTokens ?? 8000 },
  });
}

function ollamaUnreachable(c: AiConfig): AiUnavailableError {
  return new AiUnavailableError(
    `로컬 LLM(Ollama)에 연결할 수 없습니다 (${c.ollamaBaseUrl}). ` +
      `Ollama가 실행 중인지 확인하세요. (설치: https://ollama.com · 실행: 'ollama serve')`,
  );
}

async function callOllama(opts: CallOpts): Promise<string> {
  const c = cfg();
  let res: Response;
  try {
    res = await fetch(`${c.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ollamaBody(c, opts, false),
      // Next.js가 응답을 캐시하지 않도록 (매번 실제 로컬 모델 호출)
      cache: "no-store",
      // 응답이 아예 안 오는 상황에서 무한 대기 방지 (분석·요약 등 비스트리밍 호출)
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError")
      throw new AiUnavailableError(
        `로컬 모델 응답이 3분을 넘겨 중단했습니다. 더 작은 모델(예: qwen2.5:3b)을 쓰거나 설정에서 클라우드(Claude)로 바꿔보세요.`,
      );
    throw ollamaUnreachable(c);
  }
  if (res.status === 404)
    throw new AiUnavailableError(
      `Ollama에 모델 '${c.ollamaModel}' 이 없습니다. 'ollama pull ${c.ollamaModel}' 로 받거나 설정에서 다른 모델을 고르세요.`,
    );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama 오류 ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

async function* streamOllama(opts: CallOpts): AsyncGenerator<string> {
  const c = cfg();
  let res: Response;
  try {
    res = await fetch(`${c.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ollamaBody(c, opts, true),
      cache: "no-store",
    });
  } catch {
    throw ollamaUnreachable(c);
  }
  if (!res.ok || !res.body)
    throw new Error(`Ollama 스트리밍 오류 ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (obj.message?.content) yield obj.message.content;
      } catch {
        /* 부분 라인 무시 */
      }
    }
  }
}

// 매 호출마다 고유 URL을 만들어 Next.js/프록시의 GET 응답 캐시를 확실히 우회한다.
// (연결 상태는 항상 '지금 이 순간'을 반영해야 하므로 절대 캐시되면 안 된다. Ollama는 쿼리스트링을 무시.)
function tagsUrl(c: AiConfig): string {
  return `${c.ollamaBaseUrl}/api/tags?_=${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 설치된 로컬 모델 목록 (설정 UI 드롭다운용) */
export async function getInstalledOllamaModels(): Promise<string[]> {
  const c = cfg();
  try {
    const res = await fetch(tagsUrl(c), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

// ──────────────────────────── Anthropic ──────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new AiUnavailableError(
      "ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 에 키를 추가하거나 설정에서 로컬(Ollama)을 사용하세요.",
    );
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callAnthropic(opts: CallOpts): Promise<string> {
  const message = await getAnthropic().messages.create({
    model: cfg().anthropicModel,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return textOf(message);
}

async function* streamAnthropic(opts: CallOpts): AsyncGenerator<string> {
  const stream = getAnthropic().messages.stream({
    model: cfg().anthropicModel,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ───────────────────────────── 라우팅 ────────────────────────────────────

export async function callModel(opts: CallOpts): Promise<string> {
  return cfg().provider === "anthropic"
    ? callAnthropic(opts)
    : callOllama(opts);
}

export function streamModel(opts: CallOpts): AsyncGenerator<string> {
  return cfg().provider === "anthropic"
    ? streamAnthropic(opts)
    : streamOllama(opts);
}

/** 스트리밍 시작 전 공급자 사용 가능 여부를 미리 확인 (스트림 중간엔 상태코드를 못 바꾸므로) */
export async function assertProviderReady(): Promise<void> {
  const c = cfg();
  if (c.provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new AiUnavailableError(
        "ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 에 키를 추가하거나 설정에서 로컬(Ollama)을 사용하세요.",
      );
    return;
  }
  let res: Response;
  try {
    // 연결 점검은 빨리 실패해야 함 — Ollama 미실행 시 무한 대기 방지
    // (캐시 금지 + 고유 URL — 매번 실제 상태를 확인해야 배지가 거짓말하지 않음)
    res = await fetch(tagsUrl(c), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw ollamaUnreachable(c);
  }
  if (!res.ok) throw new AiUnavailableError(`Ollama 응답 오류 (${res.status}).`);
  const data = (await res.json()) as { models?: { name: string }[] };
  const names = (data.models ?? []).map((m) => m.name);
  const want = c.ollamaModel;
  const present = names.some(
    (n) =>
      n === want ||
      n === `${want}:latest` ||
      n.startsWith(`${want}:`) ||
      (!want.includes(":") && n.split(":")[0] === want),
  );
  if (!present)
    throw new AiUnavailableError(
      `Ollama에 모델 '${want}' 이 없습니다. 'ollama pull ${want}' 로 받거나 설정에서 다른 모델을 고르세요.` +
        (names.length ? ` (설치됨: ${names.join(", ")})` : ""),
    );
}

/** 모델 응답 문자열에서 JSON 오브젝트를 관대하게 추출 */
function extractJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}

// ─────────────────────────── 설정 자동 분석 (§2-1-A) ─────────────────────────

const CHARACTER_SCHEMA_HINT = `{
  "characters": [
    { "name": "이름", "appearance": "외형 묘사", "personality": "성격",
      "speech_style": "말투 특징", "goal": "목표/동기", "relationships": "관계",
      "secrets": "비밀 설정", "notes": "기타 메모" }
  ],
  "world_settings": [],
  "suggestions": ["누락/모호한 설정에 대한 보완 질문이나 제안"]
}`;

const WORLD_SCHEMA_HINT = `{
  "characters": [],
  "world_settings": [
    { "category": "시대/배경 | 규칙/시스템 | 지명 | 세력 | 용어 | 기타 중 하나",
      "title": "항목 제목", "content": "항목 상세 내용" }
  ],
  "suggestions": ["누락/모호한 설정에 대한 보완 질문이나 제안"]
}`;

export async function analyzeSettings(
  rawText: string,
  target: "characters" | "world",
): Promise<AnalysisResult> {
  const schema =
    target === "characters" ? CHARACTER_SCHEMA_HINT : WORLD_SCHEMA_HINT;
  const focus =
    target === "characters"
      ? "작가가 붙여넣은 텍스트에서 '등장인물' 정보를 추출해 캐릭터 카드 필드로 정리하세요. 인물이 여러 명이면 각각 분리하세요."
      : "작가가 붙여넣은 텍스트에서 '세계관/설정' 정보를 추출해 카테고리별 항목으로 정리하세요. 하나의 큰 글이라도 의미 단위로 여러 항목으로 분리하세요.";

  const system = `당신은 웹소설 설정 정리 보조자입니다. ${focus}

규칙:
- 텍스트에 실제로 적힌 내용만 사용하고, 사실을 지어내지 마세요.
- 명시되지 않은 필드는 빈 문자열("")로 두세요.
- 누락/모호해 작가 확인이 필요한 부분은 "suggestions" 배열에 한국어로 담으세요.
- 반드시 아래 스키마와 동일한 형태의 JSON '하나만' 출력하세요. 마크다운/설명/코드펜스 없이 순수 JSON.

스키마:
${schema}`;

  const out = await callModel({
    system,
    user: rawText,
    maxTokens: 4000,
    json: true,
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
    json: true,
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
  condition?: string;
  mode: WriteMode;
  currentBody?: string;
  targetLength: number;
}

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

function buildChapterPrompt(input: ChapterGenInput): {
  system: string;
  user: string;
} {
  const context = buildChapterContext(input);
  const system = `당신은 한국 웹소설 작가입니다. 아래 작품 정보·등장인물·세계관·플롯·맥락을 '제약 조건'으로 삼아, 그 안에서만 회차 본문을 씁니다. 'AI가 쓴 티'가 나지 않는, 사람이 쓴 듯한 장면을 써야 합니다.

[필수]
- 설정·세계관 규칙·이미 일어난 일과 모순되지 않게 쓴다.
- 작가가 지정한 톤/문체·조건이 있으면 그것을 최우선으로 따른다.
- 소설 본문만 출력한다. 머리말·해설·요약·작가 노트·메타 설명 금지.
- 분량은 목표에 근접하되, 자연스러움을 해치면서까지 채우지 않는다.

[사람처럼 쓰는 법 — AI 티 줄이기]
- 설명하지 말고 보여줘라. '그는 화났다'가 아니라 행동·표정·감각·대사로 드러내라.
- 감정과 생각을 작가가 직접 요약·해설하지 마라. 독자가 추론할 여지를 남겨라.
- 문장 길이와 리듬을 의도적으로 바꿔라. '~했다. ~했다.' 식의 단조로운 반복을 피하라.
- 추상적 미사여구 대신 구체적 감각(소리·촉감·냄새·온도·사물의 이름)을 써라.
- 대사는 인물마다 말투가 다르게, 속내를 다 말하지 않는 서브텍스트를 살려라. 설명적 대사 금지.
- 형용사·부사를 덜어내라. 비유는 한 장면에 하나면 충분하다.
- 장면을 교훈이나 깔끔한 정리로 닫지 마라. 여운이나 다음 회차를 끌어당기는 긴장으로 끝내라.

[피해야 할 상투구]
'결심이 어렸다', '알 수 없는 미소', '공기가 무거워졌다', '시간이 멈춘 듯했다', '마치 ~인 것처럼'의 남발, '~할 수밖에 없었다', '온몸에 전율이 흘렀다', '심장이 쿵 내려앉았다' 같은 표현에 기대지 말고, 그 장면에만 맞는 구체적 묘사를 새로 찾아라.`;

  let instruction: string;
  if (input.mode === "continue") {
    instruction = `아래는 지금까지 작성된 ${input.chapter.number}화 본문입니다. 이미 쓰인 내용은 다시 출력하지 말고, 자연스럽게 '이어지는 새 본문만' 출력하세요.

[지금까지의 본문]
${input.currentBody || ""}`;
  } else {
    instruction = `위 정보를 바탕으로 ${input.chapter.number}화 본문을 처음부터 집필하세요.`;
  }

  return { system, user: `${context}\n\n---\n\n${instruction}` };
}

export async function generateChapter(input: ChapterGenInput): Promise<string> {
  const { system, user } = buildChapterPrompt(input);
  return callModel({ system, user, maxTokens: 8000 });
}

/** 본문을 토큰 단위로 스트리밍 (기획안 ① 실시간 출력) */
export function generateChapterStream(
  input: ChapterGenInput,
): AsyncGenerator<string> {
  const { system, user } = buildChapterPrompt(input);
  return streamModel({ system, user, maxTokens: 8000 });
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
    json: true,
  });

  const parsed = extractJson<Partial<SummarizeResult>>(out);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    timeline_suggestions: Array.isArray(parsed.timeline_suggestions)
      ? parsed.timeline_suggestions
      : [],
  };
}
