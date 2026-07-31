/* test_damage.c — 데미지/명중 검사 (SPEC 9-1) */
#include "test.h"
#include "battle.h"
#include "moves.h"
#include "typechart.h"
#include <string.h>

/* 급소가 안 뜨고(crit draw != 0) 난수가 100(rand draw == 15)이 되는 시드를 찾는다.
 * → calc_damage 의 배율 단계를 정수 절삭 잡음 없이 정확히 검증할 수 있다.
 * (rng_range(16) 은 2의 거듭제곱이라 편향 없이 rng_next()%16 이다.) */
static uint64_t find_clean_seed(void) {
    for (uint64_t s = 1; s < 1000000; s++) {
        Rng r;
        rng_seed(&r, s, RNG_BATTLE);
        uint32_t crit = rng_range(&r, CRIT_RATE_DEN);   /* !=0 → 급소 없음 */
        uint32_t rr = rng_range(&r, DMG_RAND_SPAN);     /* ==15 → r=100 */
        if (crit != 0 && rr == 15) return s;
    }
    return 1;
}

/* 전투 개체 하나 구성 (실제 종 무관, 스탯을 직접 지정). */
static BattleMon mk(int level, int atk, int def, int spa, int spd,
                    int type1, int type2) {
    BattleMon m;
    memset(&m, 0, sizeof(m));
    m.level = (uint8_t)level;
    m.stat[STAT_ATK] = atk; m.stat[STAT_DEF] = def;
    m.stat[STAT_SPA] = spa; m.stat[STAT_SPD] = spd;
    m.stat[STAT_SPE] = 50;
    m.max_hp = 200; m.cur_hp = 200;
    m.type1 = (uint8_t)type1; m.type2 = (uint8_t)type2;
    m.status_type = STATUS_NONE;
    return m;
}

void test_damage(void) {
    uint64_t seed = find_clean_seed();
    const Move* tackle = move_get(1);   /* 들이받기: 화, 물리, 위력 40 */
    const Move* cannon = move_get(3);   /* 물대포: 수, 특수, 위력 50 */
    const Move* harden = move_get(5);   /* 단단해지기: 위력 0 (변화기) */
    Rng r;
    DamageInfo di;

    /* --- 고정 시드에서 항상 같은 값 (결정론) --- */
    BattleMon atk = mk(50, 100, 100, 100, 100, TYPE_WATER, TYPE_NONE);
    BattleMon def = mk(50, 100, 100, 100, 100, TYPE_WATER, TYPE_NONE);
    rng_seed(&r, 777, RNG_BATTLE);
    int d1 = calc_damage(&atk, &def, tackle, &r, &di);
    rng_seed(&r, 777, RNG_BATTLE);
    int d2 = calc_damage(&atk, &def, tackle, &r, &di);
    CHECK_EQ(d1, d2, "고정 시드는 항상 같은 데미지");

    /* --- 자속 정확히 3/2배 (r=100, 무급소) --- */
    BattleMon atk_stab = mk(50, 120, 100, 100, 100, TYPE_FIRE, TYPE_NONE);
    BattleMon atk_nost = mk(50, 120, 100, 100, 100, TYPE_WATER, TYPE_NONE);
    BattleMon d_neu = mk(50, 100, 100, 100, 100, TYPE_THUNDER, TYPE_NONE); /* 화→뇌 ×1 */
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_nostab = calc_damage(&atk_nost, &d_neu, tackle, &r, &di);
    CHECK(di.stab == false, "비자속 플래그 false");
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_stab = calc_damage(&atk_stab, &d_neu, tackle, &r, &di);
    CHECK(di.stab == true, "자속 플래그 true");
    CHECK_EQ(dmg_stab, dmg_nostab * STAB_NUM / STAB_DEN, "자속은 정확히 3/2배");

    /* --- 상성 4배: 수 기술을 화/토 방어자에게 → eff_num=16, 정확히 4배 --- */
    BattleMon atk_w  = mk(50, 100, 100, 120, 100, TYPE_WATER, TYPE_NONE);
    BattleMon d_neuW = mk(50, 100, 100, 100, 100, TYPE_THUNDER, TYPE_NONE); /* 수→뇌 ×1 */
    BattleMon d_x4   = mk(50, 100, 100, 100, 100, TYPE_FIRE, TYPE_EARTH);   /* 수→화×2·토×2 */
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_neu = calc_damage(&atk_w, &d_neuW, cannon, &r, &di);
    CHECK_EQ(di.effectiveness, EFF_DEN, "중립 eff_num == 4");
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_x4 = calc_damage(&atk_w, &d_x4, cannon, &r, &di);
    CHECK_EQ(di.effectiveness, 16, "4배 eff_num == 16");
    CHECK_EQ(dmg_x4, dmg_neu * 4, "상성 4배는 정확히 4배");

    /* --- 상성 무효(×0) → 데미지 0 ---
     * P1 데이터엔 ×0 조합이 없다. eff_num==0 코드 경로를 검증하기 위해
     * typechart 셀 하나(화→뇌)를 임시로 0 으로 바꾼 뒤 복원한다. */
    int idx = TYPE_FIRE * TYPE_COUNT + TYPE_THUNDER;   /* 화 공격 → 뇌 방어 */
    int byte = idx / 4, shift = (idx % 4) * 2;
    uint8_t saved = g_typechart[byte];
    g_typechart[byte] = (uint8_t)(saved & ~(0x03 << shift));   /* 해당 셀 = 0 */
    CHECK_EQ(chart_get(TYPE_FIRE, TYPE_THUNDER), 0, "임시 셀 값 0");
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_imm = calc_damage(&atk_nost, &d_neu, tackle, &r, &di);  /* 화 기술 → 뇌 */
    CHECK_EQ(dmg_imm, 0, "상성 무효면 데미지 0");
    CHECK_EQ(di.effectiveness, 0, "무효 eff_num == 0");
    g_typechart[byte] = saved;   /* 복원 */

    /* --- 위력 0 변화기는 데미지 0 --- */
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg0 = calc_damage(&atk_w, &d_neuW, harden, &r, &di);
    CHECK_EQ(dmg0, 0, "위력 0 기술은 데미지 0");

    /* --- 화상 물리 정확히 절반 (r=100, 무급소) --- */
    BattleMon atk_burn = mk(50, 120, 100, 100, 100, TYPE_WATER, TYPE_NONE);
    BattleMon atk_ok   = mk(50, 120, 100, 100, 100, TYPE_WATER, TYPE_NONE);
    atk_burn.status_type = STATUS_BURN;
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_ok = calc_damage(&atk_ok, &d_neu, tackle, &r, &di);
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_b = calc_damage(&atk_burn, &d_neu, tackle, &r, &di);
    CHECK_EQ(dmg_b, dmg_ok / BURN_PHYS_DIV, "화상 물리는 정확히 절반");

    /* --- 최소 데미지 1 보장 --- */
    BattleMon weak = mk(1, 1, 100, 1, 100, TYPE_WATER, TYPE_NONE);
    BattleMon tank = mk(1, 1, 255, 1, 255, TYPE_WATER, TYPE_NONE); /* 화→수 ×0.5 */
    weak.status_type = STATUS_BURN;
    rng_seed(&r, seed, RNG_BATTLE);
    int dmg_min = calc_damage(&weak, &tank, tackle, &r, &di);
    CHECK_EQ(dmg_min, DMG_MIN, "최소 데미지 1 보장");

    /* --- 명중: 필중(101)은 항상 명중 --- */
    rng_seed(&r, 3, RNG_BATTLE);
    CHECK(check_hit(harden, &r) == true, "명중 101 은 필중");
}
