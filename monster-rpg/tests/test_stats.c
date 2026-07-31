/* test_stats.c — 스탯 계산 손계산 케이스 (SPEC 9-1 A/B/C).
 * 이 값들은 명세의 일부다. 구현이 다른 값을 내면 구현이 틀린 것이다. */
#include "test.h"
#include "monster.h"

void test_stats(void) {
    /* 케이스 A: base=60, 우성=10, 열성=10, Lv=50, 성격 보정 없음 → 75 */
    uint8_t gA = (uint8_t)(10 | (10 << 4));   /* dom=10, rec=10 */
    CHECK_EQ(iv_normal(gA), 21, "A iv_normal");
    CHECK_EQ(calc_stat(60, 21, 50, NATURE_NEUTRAL), 75, "A calc_stat");

    /* 케이스 B: base=45, 우성=7, 열성=3, Lv=50 → HP 112 */
    uint8_t gB = (uint8_t)(7 | (3 << 4));     /* dom=7, rec=3 */
    CHECK_EQ(iv_normal(gB), 14, "B iv_normal");
    CHECK_EQ(calc_hp(45, 14, 50), 112, "B calc_hp");

    /* 케이스 C: 케이스 B 개체의 되돌이 상태 → HP 108 (최대 HP 감소) */
    CHECK_EQ(iv_awakened(gB), 6, "C iv_awakened");
    CHECK_EQ(calc_hp(45, 6, 50), 108, "C calc_hp");

    /* 성격 보정 테이블 검증 (SPEC 6-2). 0=용맹: 상승 공격, 하락 특공. */
    CHECK_EQ(nature_num_for(0, STAT_ATK), NATURE_UP,      "용맹 공격 상승");
    CHECK_EQ(nature_num_for(0, STAT_SPA), NATURE_DOWN,    "용맹 특공 하락");
    CHECK_EQ(nature_num_for(0, STAT_DEF), NATURE_NEUTRAL, "용맹 방어 중립");
    /* 11=명랑: 상승 스피드, 하락 공격 */
    CHECK_EQ(nature_num_for(11, STAT_SPE), NATURE_UP,   "명랑 스피드 상승");
    CHECK_EQ(nature_num_for(11, STAT_ATK), NATURE_DOWN, "명랑 공격 하락");
    /* HP 는 항상 중립 */
    CHECK_EQ(nature_num_for(9, STAT_HP), NATURE_NEUTRAL, "HP 항상 중립");
}
