/* test_awaken.c — 되돌이 검사 (SPEC 9-1, 6-5) */
#include "test.h"
#include "battle.h"
#include "monster.h"
#include "species.h"
#include "moves.h"
#include <string.h>

/* 종1(불꽃도마뱀, base HP 45) 의 개체를 유전자 지정으로 만든다.
 * HP 유전자 우성7/열성3 → 평상시 IV14, 되돌이 IV6 (SPEC 9-1 B/C). */
static BattleMon make_mon(uint8_t hp_dom, uint8_t hp_rec, uint8_t atk_rec,
                          uint8_t ability) {
    uint8_t genes[STAT_COUNT];
    memset(genes, 0, sizeof(genes));
    genes[STAT_HP]  = (uint8_t)(hp_dom | (hp_rec << 4));
    genes[STAT_ATK] = (uint8_t)(5 | (atk_rec << 4));   /* 우성 5, 열성 지정 */
    Monster mon = debug_make(1, 50, genes, 0 /* 성격 용맹 */);
    BattleMon bm;
    battlemon_init(&bm, &mon);
    bm.ability = ability;
    return bm;
}

void test_awaken(void) {
    AwakenConfig cfg = awaken_config_default();   /* 25%, 턴종료 */
    BattleLog log; log_init(&log, false);

    /* max_hp = calc_hp(45,14,50) = 112. 25% 경계 = 28. */

    /* HP 25% 초과에서는 발동하지 않는다 (cur=29 → 29*4=116 > 112) */
    BattleMon a = make_mon(7, 3, 0, ABILITY_NONE);
    CHECK_EQ(a.max_hp, 112, "평상시 max_hp 112");
    a.cur_hp = 29;
    check_awaken(&a, 0, &log, &cfg);
    CHECK(a.awakened == false, "25% 초과는 미발동");

    /* HP 25% 이하에서 발동 (cur=28 → 28*4=112 <= 112) */
    BattleMon b = make_mon(7, 3, 0, ABILITY_NONE);
    b.cur_hp = 28;
    check_awaken(&b, 0, &log, &cfg);
    CHECK(b.awakened == true, "25% 이하는 발동");
    /* 발동 후 스탯이 열성 기준으로 재계산 (max_hp 112 → 108) */
    CHECK_EQ(b.max_hp, 108, "되돌이 후 max_hp 108 (열성 재계산)");
    /* HP 비율 보존: 28 * 108 / 112 = 27 */
    CHECK_EQ(b.cur_hp, 27, "되돌이 시 HP 비율 보존 (28→27)");

    /* 두 번 발동하지 않는다 */
    int max_after = b.max_hp;
    b.cur_hp = 1;
    check_awaken(&b, 0, &log, &cfg);
    CHECK_EQ(b.max_hp, max_after, "두 번 발동하지 않음 (max 불변)");

    /* HP 회복 후에도 되돌이 유지 */
    b.cur_hp = b.max_hp;
    check_awaken(&b, 0, &log, &cfg);
    CHECK(b.awakened == true, "HP 회복 후에도 되돌이 유지");

    /* 회귀거부 특성은 발동하지 않는다 */
    BattleMon c = make_mon(7, 3, 0, ABILITY_REFUSE_RETURN);
    c.cur_hp = 1;
    check_awaken(&c, 0, &log, &cfg);
    CHECK(c.awakened == false, "회귀거부는 미발동");

    /* 조기회귀 특성은 40% 에서 발동한다.
     * cur=40 (40/112≈35.7%): 일반은 미발동(25%), 조기회귀는 발동(40%). */
    BattleMon d_none = make_mon(7, 3, 0, ABILITY_NONE);
    d_none.cur_hp = 40;
    check_awaken(&d_none, 0, &log, &cfg);
    CHECK(d_none.awakened == false, "일반 특성은 35.7%에서 미발동");
    BattleMon d_early = make_mon(7, 3, 0, ABILITY_EARLY_RETURN);
    d_early.cur_hp = 40;
    check_awaken(&d_early, 0, &log, &cfg);
    CHECK(d_early.awakened == true, "조기회귀는 40% 구간에서 발동");

    /* 열성 조건 스킬(ID 8, 열성 공격>=12)이 되돌이 전에는 선택 불가, 후에는 가능.
     * 종1 스킬 슬롯 3 = 야성의송곳니. 열성 공격 13 으로 설정. */
    BattleMon e = make_mon(7, 3, 13, ABILITY_NONE);
    CHECK_EQ(e.move_id[3], 8, "슬롯3 은 야성의송곳니(ID 8)");
    CHECK(battle_move_selectable(&e, 3) == false, "되돌이 전 열성기 선택 불가");
    e.cur_hp = 10;
    check_awaken(&e, 0, &log, &cfg);
    CHECK(e.awakened == true, "되돌이 발동");
    CHECK(battle_move_selectable(&e, 3) == true, "되돌이 후 열성기 선택 가능");

    /* 되돌이했지만 열성 공격값이 임계 미만이면 여전히 선택 불가 */
    BattleMon f = make_mon(7, 3, 5, ABILITY_NONE);  /* 열성 공격 5 < 12 */
    f.cur_hp = 10;
    check_awaken(&f, 0, &log, &cfg);
    CHECK(f.awakened == true, "되돌이 발동(f)");
    CHECK(battle_move_selectable(&f, 3) == false, "열성값 미달이면 되돌이 후에도 불가");
}
