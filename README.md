# WebNovel Studio ✒️

> AI가 회차를 자동 집필하되, 작가가 **세계관·캐릭터·플롯이라는 제약 조건** 안에서만 쓰도록
> 관리하는 웹소설 연재 도구. (1인 작가용 로컬 웹 앱)

“AI 자동 집필 + 작가 보조 도구”의 결합 — AI가 글을 쓰지만, 작가가 등록한 설정과
플롯을 벗어나지 않게 일관성을 유지합니다.

---

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. AI 모델 준비
#   [기본] 로컬 Ollama — API 키·인터넷 불필요
#     1) https://ollama.com 설치
#     2) ollama pull qwen2.5:7b   (가벼운 PC면 qwen2.5:3b)
#   [옵션] Claude 클라우드를 쓰려면:
#     cp .env.example .env.local 후 AI_PROVIDER=anthropic + ANTHROPIC_API_KEY 설정

# 3. 개발 서버 실행
npm run dev
#   → http://localhost:3000

# 프로덕션 빌드
npm run build && npm start
```

> **AI 기능(자동 집필·설정 분석·일관성 점검)** 은 로컬 Ollama(기본) 또는 Claude 클라우드로 동작합니다.
> 모델이 준비되지 않아도 CRUD(작품/캐릭터/세계관/회차/플롯)와 txt 내보내기는 모두 쓸 수 있고,
> AI 호출 시 연결이 안 되면 친절한 안내 메시지를 보여줍니다.

### 환경 변수 (모두 선택 — 기본값으로 바로 동작)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AI_PROVIDER` | `ollama` | `ollama`(로컬) 또는 `anthropic`(클라우드) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | 로컬 Ollama 주소 |
| `OLLAMA_MODEL` | `qwen2.5:7b` | 로컬 모델 (가벼운 PC면 `qwen2.5:3b`) |
| `ANTHROPIC_API_KEY` | — | `AI_PROVIDER=anthropic` 일 때 필요 |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | 클라우드 모델 |
| `DATABASE_PATH` | `./data/webnovel.db` | SQLite 파일 경로 |

---

## 기술 스택

기획안 §4 의 제안을 기반으로, 프런트엔드·백엔드를 한 프로젝트로 묶어 단일 사용자
로컬 환경에 가장 단순하게 동작하도록 구성했습니다.

- **Next.js 14 (App Router) + React 18 + TypeScript** — UI와 API Routes를 한 코드베이스로
- **Tailwind CSS** — 스타일
- **SQLite (better-sqlite3)** — 로컬 단일 파일 DB (확장 시 PostgreSQL로 교체 가능)
- **AI: 로컬 LLM(Ollama) 기본 + Anthropic Claude 옵션** — 공급자 추상화 계층(`src/lib/ai.ts`)으로
  `AI_PROVIDER` 환경변수만 바꾸면 전환. 기본은 키 없이 오프라인으로 도는 로컬 모델.

> 별도의 Express 서버 + Vite 대신 Next.js API Routes로 통합해, 실행·배포 단위를 하나로 줄였습니다.

---

## 주요 기능 (기획안 매핑)

| 기획안 | 구현 |
| --- | --- |
| §2-1 캐릭터/세계관 설정 관리 (직접 입력) | `캐릭터 관리`, `세계관/설정집` 탭의 CRUD |
| §2-1-A 설정 자동 분석/추출 | 자유 텍스트 붙여넣기 → AI가 필드별 분류 → **좌우 비교 검수** 후 채택 저장 |
| §2-2 플롯/전개 일관성 | 플롯 라인(기-승-전-결/자유), 타임라인(이미 일어난 일), **AI 일관성 점검**(모순 경고) |
| §2-3 회차별 자동 집필 | 에디터의 `자동 생성` / `이어쓰기`(보조 모드) / `재생성` |
| §2-3-A 조건 기반 집필 | 자연어 조건 입력 + **일회성/지속** 선택 (지속은 작품 가이드로 저장) |
| §2-4 연재 관리 | 회차 상태(초고·퇴고·완료), 글자 수/목표 분량 진행률, **txt 내보내기** |
| §6 AI 집필 로직 | 작품·캐릭터·세계관·직전 회차 요약·타임라인·beat·조건·분량을 컨텍스트로 주입 |
| §6 출력 후 처리 | `요약·사건 갱신` → 다음 회차용 요약 저장 + 새 사건 타임라인 기록 제안 |

### 화면 구성

- **대시보드** (`/`) — 작품 목록, 회차/완료/글자 수 진행 상황
- **작품 상세** (`/works/[id]`) — 사이드바 탭: 회차 목록 · 캐릭터 관리 · 세계관/설정집 · 플롯/타임라인 · 작품 설정
- **집필 에디터** (`/works/[id]/chapters/[id]`) — 좌: 본문 / 우: 주입 컨텍스트 패널 / 상단: AI 버튼 / 중단: 조건 입력 / 하단: 분량 진행률

---

## AI 집필 흐름 (§6)

회차 생성 요청 시 AI에게 전달되는 컨텍스트:

1. 작품 기본 정보 (장르·톤·시놉시스·지속 집필 조건)
2. 등장인물 카드
3. 세계관 설정
4. 직전 회차 요약 + 타임라인
5. 이번 회차 목표 사건(beat)
6. 이번 회차 일회성 조건
7. 목표 분량

생성 후 `요약·사건 갱신` 버튼으로 본문 요약을 만들어 다음 회차 컨텍스트 비용을 줄이고
일관성을 유지하며, 새로 발생한 사건을 타임라인에 기록하도록 제안합니다.

> 설정 분석·일관성 점검 등 구조화 응답은 모델에 JSON 출력을 지시하고 관대하게 파싱합니다.

**실시간 스트리밍**: 본문은 생성되는 즉시 에디터에 토큰 단위로 표시되고, 완료되면 자동 저장됩니다.
**AI 전환**: 헤더의 `⚙️ AI 설정`에서 공급자(로컬 Ollama ↔ Claude)와 모델을 화면에서 바꾸고, “연결 확인”으로 상태를 점검할 수 있습니다. (설정은 DB에 저장되어 env 기본값보다 우선)

---

## 데이터 모델 (기획안 §5)

`Work` · `Character` · `WorldSetting` · `PlotPoint` · `Chapter` · `TimelineEvent`
— 스키마는 [`src/lib/db.ts`](src/lib/db.ts), 타입은 [`src/lib/types.ts`](src/lib/types.ts).

DB 파일은 첫 실행 시 `data/webnovel.db` 에 자동 생성됩니다(gitignore 처리).

---

## 프로젝트 구조

```
src/
├─ app/
│  ├─ page.tsx                       # 대시보드
│  ├─ works/[workId]/                # 작품 상세 (사이드바 레이아웃)
│  │  ├─ chapters/                   #   회차 목록 + 에디터([chapterId])
│  │  ├─ characters/ world/ plot/ settings/
│  └─ api/                           # REST API Routes
│     ├─ works · characters · world · plot · timeline · chapters …
│     └─ works/[workId]/analyze · import · check   (AI)
│        chapters/[id]/generate · summarize · export
├─ components/                       # 클라이언트 UI (매니저/에디터/패널)
└─ lib/
   ├─ db.ts        # SQLite 연결 + 스키마
   ├─ repo.ts      # 데이터 접근 계층
   ├─ ai.ts        # AI 공급자 추상화 (Ollama/Anthropic) — 집필/분석/요약/점검
   ├─ types.ts     # 도메인 타입
   └─ http.ts      # API 응답 헬퍼
```

---

## 1차 범위(MVP) 메모

기획안 §7 의 1차 범위를 모두 포함합니다(작품/캐릭터/세계관/회차 CRUD, 설정 자동 분석,
회차 자동 생성 + 보조 모드, 조건 기반 집필, 직전 요약 컨텍스트, 분량 표시, txt 내보내기).

추후 검토 항목(외부 플랫폼 자동 업로드, 고도화된 모순 자동 검증, 다중 사용자, 삽화 생성)은
제외했습니다. 일관성 점검은 1차 버전답게 “규칙 기반 + AI 검수”로 명백한 모순만 경고합니다.

> 참고: 의존성 감사에서 보고되는 경고는 개발 도구(CSS 처리)의 알려진 항목으로, 단일 사용자
> 로컬 도구의 런타임 위험과는 무관합니다.
