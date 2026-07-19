// ─────────────────────────────────────────────────────────────────────────
// 데이터 모델 (기획안 §5)
// DB row 형태를 그대로 반영한 타입들.
// ─────────────────────────────────────────────────────────────────────────

export type ChapterStatus = "초고" | "퇴고" | "완료";

export const CHAPTER_STATUSES: ChapterStatus[] = ["초고", "퇴고", "완료"];

/** 세계관 항목 분류 (기획안 §2-1) */
export const WORLD_CATEGORIES = [
  "시대/배경",
  "규칙/시스템",
  "지명",
  "세력",
  "용어",
  "기타",
] as const;

export type WorldCategory = (typeof WORLD_CATEGORIES)[number];

export interface Work {
  id: number;
  title: string;
  genre: string;
  tone: string;
  default_length: number;
  synopsis: string;
  /** 작품 전체에 지속 적용되는 집필 조건 (기획안 §2-3-A) */
  persistent_conditions: string;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: number;
  work_id: number;
  name: string;
  appearance: string;
  personality: string;
  speech_style: string;
  goal: string;
  relationships: string;
  secrets: string;
  notes: string;
  order_index: number;
  created_at: string;
}

export interface WorldSetting {
  id: number;
  work_id: number;
  category: string;
  title: string;
  content: string;
  order_index: number;
  created_at: string;
}

export interface PlotPoint {
  id: number;
  work_id: number;
  order_index: number;
  title: string;
  description: string;
  /** 이 비트가 등장할 목표 회차 (선택) */
  target_chapter: number | null;
  created_at: string;
}

export interface Chapter {
  id: number;
  work_id: number;
  number: number;
  title: string;
  body: string;
  status: ChapterStatus;
  word_count: number;
  /** 다음 회차 컨텍스트용 요약 (기획안 §6) */
  summary: string;
  /** 이번 회차 목표 사건(beat) */
  beat: string;
  /** 이 회차 집필에 주입할 캐릭터 id 목록 (CSV). 빈 값이면 전체 (기획안 §6 등장인물 선별) */
  included_character_ids: string;
  /** 이 회차 집필에 주입할 세계관 항목 id 목록 (CSV). 빈 값이면 전체 */
  included_world_ids: string;
  /** 공개 독자 사이트 발행 여부 (0/1) */
  published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 발행 자동 업로드 대상 (웹훅/디스코드) */
export interface PublishTarget {
  id: number;
  work_id: number;
  type: string; // "webhook" | "discord"
  label: string;
  url: string;
  enabled: number;
  created_at: string;
}

export interface TimelineEvent {
  id: number;
  work_id: number;
  chapter_id: number | null;
  description: string;
  /** 관련 인물 (쉼표 구분 자유 텍스트) */
  involved_characters: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// AI 설정 자동 분석 결과 형태 (기획안 §2-1-A, §6)
// ─────────────────────────────────────────────────────────────────────────

export interface AnalyzedCharacter {
  name: string;
  appearance: string;
  personality: string;
  speech_style: string;
  goal: string;
  relationships: string;
  secrets: string;
  notes: string;
}

export interface AnalyzedWorldSetting {
  category: string;
  title: string;
  content: string;
}

export interface AnalysisResult {
  characters: AnalyzedCharacter[];
  world_settings: AnalyzedWorldSetting[];
  /** 누락/모호한 설정에 대한 보완 제안 (기획안 §2-1-A) */
  suggestions: string[];
}
