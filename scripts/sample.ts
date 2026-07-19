// 실제 집필 품질을 한 줄로 확인하는 스크립트.  실행: npm run sample
// 설정된 공급자(Ollama 기본 / Claude)로 데모 회차를 터미널에 스트리밍합니다.
import { generateChapterStream, getActiveAiInfo } from "../src/lib/ai";
import type { Character, Work } from "../src/lib/types";

const work: Work = {
  id: 0,
  title: "회귀한 검성의 두 번째 삶",
  genre: "판타지",
  tone: "진지하고 속도감 있게, 대사 위주",
  default_length: 1200,
  synopsis: "죽었던 검성이 모든 것을 잃은 뒤 십 년 전으로 회귀한다.",
  persistent_conditions: "군더더기 없이. 묘사보다 행동과 대사로.",
  created_at: "",
  updated_at: "",
};

const characters: Character[] = [
  {
    id: 1,
    work_id: 0,
    name: "카엘",
    appearance: "은발에 잿빛 눈, 왼쪽 눈가에 오래된 흉터",
    personality: "냉소적이지만 동료에게는 무뚝뚝하게 다정함",
    speech_style: "짧고 건조한 말투, 군말이 없음",
    goal: "이번 생에는 여동생을 살린다",
    relationships: "여동생 리나",
    secrets: "자신이 죽고 회귀했다는 사실을 아무도 모른다",
    notes: "",
    order_index: 0,
    created_at: "",
  },
];

async function main() {
  const info = getActiveAiInfo();
  process.stderr.write(
    `\n[엔진: ${info.provider === "ollama" ? "로컬 Ollama" : "Claude"} · ${info.model}]\n` +
      `데모 회차를 생성합니다…\n\n────────────────────────────\n`,
  );

  const gen = generateChapterStream({
    work,
    characters,
    worldSettings: [],
    prevChapter: null,
    timeline: [],
    chapter: {
      number: 1,
      beat: "회귀를 자각하고, 죽기 직전 마주했던 적의 얼굴을 떠올린다",
    },
    mode: "auto",
    targetLength: work.default_length,
  });

  for await (const delta of gen) process.stdout.write(delta);
  process.stdout.write("\n────────────────────────────\n\n");
}

main().catch((e) => {
  process.stderr.write(`\n오류: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
