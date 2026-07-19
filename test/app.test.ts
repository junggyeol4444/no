import assert from "node:assert/strict";
import { test } from "node:test";
import { authToken } from "../src/lib/authToken";
import { ruleBasedWarnings } from "../src/lib/checks";
import {
  countChars,
  createChapter,
  createWork,
  getWork,
  insertChapterAfter,
  listChapters,
} from "../src/lib/repo";
import type { Chapter, TimelineEvent } from "../src/lib/types";

test("countChars 는 공백을 제외한다", () => {
  assert.equal(countChars("가 나  다\n라"), 4);
  assert.equal(countChars("  "), 0);
});

test("작품·회차 생성과 중간 삽입(번호 밀기)", () => {
  const w = createWork({ title: "테스트 작품" });
  assert.ok(getWork(w.id), "작품이 조회되어야 한다");

  const c1 = createChapter(w.id, { title: "1화" });
  const c2 = createChapter(w.id, { title: "2화" });
  assert.equal(c1.number, 1);
  assert.equal(c2.number, 2);

  const inserted = insertChapterAfter(w.id, 1);
  assert.equal(inserted.number, 2, "1화 다음에 삽입되면 2화가 된다");

  const numbers = listChapters(w.id).map((c) => c.number);
  assert.deepEqual(numbers, [1, 2, 3], "이후 회차 번호가 밀려야 한다");
});

test("규칙 기반 점검: 미등록 인물과 회차 번호 중복", () => {
  const timeline: TimelineEvent[] = [
    {
      id: 1,
      work_id: 1,
      chapter_id: null,
      description: "결투",
      involved_characters: "유령인물",
      created_at: "",
    },
  ];
  const dupChapters = [
    { number: 1 } as Chapter,
    { number: 1 } as Chapter,
  ];
  const warnings = ruleBasedWarnings({
    characters: [],
    worldSettings: [],
    plot: [],
    timeline,
    chapters: dupChapters.map((c) => ({ ...c, body: "", status: "초고" }) as Chapter),
  });
  assert.ok(
    warnings.some((w) => w.includes("유령인물")),
    "미등록 인물 경고가 있어야 한다",
  );
  assert.ok(
    warnings.some((w) => w.includes("중복")),
    "회차 번호 중복 경고가 있어야 한다",
  );
});

test("authToken 은 결정적이며 입력마다 다르다", () => {
  assert.equal(authToken("secret"), authToken("secret"));
  assert.notEqual(authToken("a"), authToken("b"));
});
