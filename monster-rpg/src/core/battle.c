/* battle.c — 전투 상태 기계 (SPEC 6-3~6-7) */
#include "battle.h"
#include "species.h"
#include "typechart.h"
#include <string.h>

AwakenConfig awaken_config_default(void) {
    AwakenConfig c;
    c.threshold_num = AWAKEN_THRESHOLD_NUM;
    c.threshold_den = AWAKEN_THRESHOLD_DEN;
    c.immediate = false;
    return c;
}

void recalc_stats(BattleMon* m) {
    /* SPEC 6-6. 되돌이 여부에 따라 우성/열성 IV 로 재계산한다. */
    const Species* sp = species_get(m->species_id);
    for (int i = 0; i < STAT_COUNT; i++) {
        int iv = m->awakened ? iv_awakened(m->genes[i]) : iv_normal(m->genes[i]);
        if (i == STAT_HP) {
            m->max_hp = calc_hp(sp->base_stats[i], iv, m->level);
        } else {
            m->stat[i] = calc_stat(sp->base_stats[i], iv, m->level,
                                   nature_num_for(m->nature, i));
        }
    }
}

void battlemon_init(BattleMon* bm, const Monster* mon) {
    memset(bm, 0, sizeof(*bm));
    bm->species_id = mon->species_id;
    bm->level = mon->level;
    memcpy(bm->genes, mon->genes, STAT_COUNT);
    bm->nature = mon->nature;
    bm->ability = mon->ability;
    const Species* sp = species_get(mon->species_id);
    bm->type1 = sp->type1;
    bm->type2 = sp->type2;
    bm->awakened = false;
    recalc_stats(bm);
    /* 개체의 현재 HP 를 그대로 반영 (0 이면 기절). 신규 전투는 만피로 온다. */
    bm->cur_hp = mon->cur_hp > 0 ? (int)mon->cur_hp : bm->max_hp;
    if (bm->cur_hp > bm->max_hp) bm->cur_hp = bm->max_hp;
    bm->status_type = mon->status_type;
    bm->status_counter = mon->status_counter;
    memcpy(bm->move_id, mon->move_id, MOVES_PER_MON);
    memcpy(bm->move_pp, mon->move_pp, MOVES_PER_MON);
}

static bool has_type(const BattleMon* m, int t) {
    return m->type1 == t || (m->type2 != TYPE_NONE && m->type2 == t);
}

int calc_damage(const BattleMon* atk, const BattleMon* def,
                const Move* mv, Rng* rng, DamageInfo* out) {
    out->stab = false;
    out->crit = false;
    out->effectiveness = EFF_DEN;   /* ×1.0 자리값 (4/4) */

    if (mv->power == 0) return 0;

    int mvt = move_type(mv);
    int a, d;
    if (move_class(mv) == CLASS_PHYSICAL) {
        a = atk->stat[STAT_ATK];
        d = def->stat[STAT_DEF];
    } else {
        a = atk->stat[STAT_SPA];
        d = def->stat[STAT_SPD];
    }

    /* 1) 기본식 (SPEC 6-3). 연산 순서 고정. */
    int dmg = DMG_LEVEL_MUL * atk->level / DMG_LEVEL_DIV + DMG_LEVEL_ADD;
    dmg = dmg * mv->power;
    dmg = dmg * a;
    dmg = dmg / d;
    dmg = dmg / DMG_BASE_DIV;
    dmg = dmg + DMG_BASE_ADD;

    /* 2) 자속 ×3/2 */
    if (has_type(atk, mvt)) {
        dmg = dmg * STAB_NUM / STAB_DEN;
        out->stab = true;
    }

    /* 3) 상성 — 배율을 4분모로 표현 (SPEC 6-3 (3)) */
    int eff_num = EFF_DEN;
    eff_num = eff_num * g_eff_table[chart_get(mvt, def->type1)] / EFF_DEN;
    if (def->type2 != TYPE_NONE)
        eff_num = eff_num * g_eff_table[chart_get(mvt, def->type2)] / EFF_DEN;
    dmg = dmg * eff_num / EFF_DEN;
    out->effectiveness = eff_num;
    if (eff_num == 0) return 0;   /* 데미지 0 은 상성 무효뿐 (SPEC 6-3 주의) */

    /* 4) 급소 1/16, ×3/2 */
    if (rng_chance(rng, 1, CRIT_RATE_DEN)) {
        dmg = dmg * CRIT_NUM / CRIT_DEN;
        out->crit = true;
    }

    /* 5) 상태 보정 — 화상 시 물리 ×1/2 */
    if (atk->status_type == STATUS_BURN && move_class(mv) == CLASS_PHYSICAL) {
        dmg = dmg / BURN_PHYS_DIV;
    }

    /* 6) 난수 85~100 — 반드시 마지막에 뽑는다 (SPEC 6-3 주의) */
    int r = DMG_RAND_MIN + (int)rng_range(rng, DMG_RAND_SPAN);
    dmg = dmg * r / DMG_RAND_DIV;

    /* 7) 하한 */
    if (dmg < DMG_MIN) dmg = DMG_MIN;
    return dmg;
}

bool check_hit(const Move* mv, Rng* rng) {
    /* SPEC 6-4. 명중 101 이상은 필중. */
    if (mv->accuracy > ACCURACY_ALWAYS) return true;
    return (int)rng_range(rng, ACCURACY_DEN) < mv->accuracy;
}

void check_awaken(BattleMon* m, int side, BattleLog* log, const AwakenConfig* cfg) {
    /* SPEC 6-5 */
    if (m->awakened) return;
    if (m->cur_hp <= 0) return;
    if (m->ability == ABILITY_REFUSE_RETURN) return;   /* 회귀거부 */

    int num = cfg->threshold_num;
    int den = cfg->threshold_den;
    if (m->ability == ABILITY_EARLY_RETURN) {          /* 조기회귀 40% */
        num = AWAKEN_EARLY_NUM; den = AWAKEN_EARLY_DEN;
    } else if (m->ability == ABILITY_LATE_RETURN) {    /* 만성회귀 15% */
        num = AWAKEN_LATE_NUM; den = AWAKEN_LATE_DEN;
    }

    if (m->cur_hp * den > m->max_hp * num) return;     /* 임계 초과 → 미발동 */

    /* 발동 */
    int old_max = m->max_hp;
    int old_cur = m->cur_hp;
    m->awakened = true;
    recalc_stats(m);                    /* iv_awakened 로 재계산 */
    int new_max = m->max_hp;

    /* 현재 HP 비율 보존. 최소 1 보장 (SPEC 6-5). */
    int new_cur = m->cur_hp * new_max / old_max;
    if (new_cur < 1) new_cur = 1;
    if (new_cur > new_max) new_cur = new_max;
    m->cur_hp = new_cur;

    log_awaken(log, side, old_max, new_max, old_cur, new_cur);
}

bool battle_move_selectable(const BattleMon* m, int slot) {
    if (slot < 0 || slot >= MOVES_PER_MON) return false;
    if (m->move_pp[slot] == 0) return false;
    const Move* mv = move_get(m->move_id[slot]);
    if (!mv) return false;
    int stat = (mv->gene_cond >> 4) & 0x07;
    int target_rec = (mv->gene_cond >> 7) & 0x01;
    /* 열성 조건 스킬은 되돌이 상태에서만 선택 가능 (SPEC 7-7, T1-8) */
    if (stat != 0 && target_rec && !m->awakened) return false;
    if (stat == 0) return true;
    int idx = stat - 1;
    int threshold = mv->gene_cond & 0x0F;
    int val = target_rec ? GENE_REC(m->genes[idx]) : GENE_DOM(m->genes[idx]);
    return val >= threshold;
}

void battle_init(BattleState* st, const Monster* p0, const Monster* p1,
                 AwakenConfig cfg) {
    memset(st, 0, sizeof(*st));
    battlemon_init(&st->mon[0], p0);
    battlemon_init(&st->mon[1], p1);
    st->turn = 0;
    st->over = false;
    st->winner = -1;
    st->awaken = cfg;
}

/* 되돌이를 지금(즉시 타이밍) 검사해야 하면 검사. 턴종료 타이밍이면 아무것도 안 함. */
static void maybe_awaken_now(BattleState* st, int side, BattleLog* log) {
    if (st->awaken.immediate) {
        check_awaken(&st->mon[side], side, log, &st->awaken);
        if (st->mon[side].awakened) st->awakened_ever[side] = true;
    }
}

/* 한 측의 행동 실행. 상대(other)가 기절하면 true 반환 → 후공 생략 판단용. */
static void execute_action(BattleState* st, int side, Action act,
                           Rng* rng, BattleLog* log) {
    BattleMon* atk = &st->mon[side];
    BattleMon* def = &st->mon[1 - side];
    int other = 1 - side;

    if (atk->cur_hp <= 0) return;   /* 이미 기절한 개체는 행동 없음 */

    int slot = act.move_slot;
    if (slot < 0 || slot >= MOVES_PER_MON) slot = 0;
    const Move* mv = move_get(atk->move_id[slot]);
    if (!mv) return;

    log_act(log, side, atk->move_id[slot]);
    if (atk->move_pp[slot] > 0) atk->move_pp[slot]--;

    /* 변화기/위력 0 (P1: 단단해지기는 무동작) — ACT 만 남기고 끝. */
    if (move_class(mv) == CLASS_STATUS || mv->power == 0) return;

    if (!check_hit(mv, rng)) {
        log_miss(log, side);
        return;
    }

    DamageInfo di;
    int dmg = calc_damage(atk, def, mv, rng, &di);
    def->cur_hp -= dmg;
    if (def->cur_hp < 0) def->cur_hp = 0;
    log_hit(log, side, dmg, di.effectiveness, di.crit ? 1 : 0, di.stab ? 1 : 0);

    /* 즉시 타이밍이면 피격 직후 되돌이 검사 (SPEC 6-7 주석 [검증필요]) */
    if (def->cur_hp > 0) maybe_awaken_now(st, other, log);
}

/* 턴 종료 지속 데미지 (SPEC 6-7 6단계, T1-7). */
static void end_of_turn_status(BattleState* st, int side, Rng* rng, BattleLog* log) {
    (void)rng;
    BattleMon* m = &st->mon[side];
    if (m->cur_hp <= 0) return;
    int dmg = 0;
    if (m->status_type == STATUS_BURN) {
        dmg = m->max_hp / BURN_TICK_DIV;       /* 화상: 최대HP 1/16 */
    } else if (m->status_type == STATUS_POISON) {
        dmg = m->max_hp / POISON_TICK_DIV;     /* 독: 최대HP 1/8 */
    }
    if (m->status_type == STATUS_BURN || m->status_type == STATUS_POISON) {
        if (dmg < DMG_MIN) dmg = DMG_MIN;      /* 지속 데미지 최소 1 */
        m->cur_hp -= dmg;
        if (m->cur_hp < 0) m->cur_hp = 0;
        log_status(log, side, m->status_type, dmg);
        if (m->cur_hp > 0) maybe_awaken_now(st, side, log);
    }
    /* 카운터가 있는 상태이상은 감소 후 만료 시 해제. P1 화상/독은 카운터 0(지속). */
    if (m->status_counter > 0) {
        m->status_counter--;
        if (m->status_counter == 0) m->status_type = STATUS_NONE;
    }
}

/* 선공 측을 정한다 (SPEC 6-7 2~4). 반환: 먼저 행동할 side (0/1). */
static int decide_order(const BattleState* st, Action a0, Action a1, Rng* rng) {
    const Move* m0 = move_get(st->mon[0].move_id[
        (a0.move_slot >= 0 && a0.move_slot < MOVES_PER_MON) ? a0.move_slot : 0]);
    const Move* m1 = move_get(st->mon[1].move_id[
        (a1.move_slot >= 0 && a1.move_slot < MOVES_PER_MON) ? a1.move_slot : 0]);
    int pr0 = m0 ? move_priority(m0) : 0;
    int pr1 = m1 ? move_priority(m1) : 0;
    if (pr0 != pr1) return pr0 > pr1 ? 0 : 1;
    int s0 = st->mon[0].stat[STAT_SPE];
    int s1 = st->mon[1].stat[STAT_SPE];
    if (s0 != s1) return s0 > s1 ? 0 : 1;
    return (int)rng_range(rng, 2);   /* 동속 무작위 */
}

void battle_step(BattleState* st, Action a0, Action a1, Rng* rng, BattleLog* log) {
    if (st->over) return;

    st->turn++;
    log_turn(log, st->turn);

    /* 2~4) 순서 결정 */
    int first = decide_order(st, a0, a1, rng);
    Action fa = (first == 0) ? a0 : a1;
    Action sa = (first == 0) ? a1 : a0;
    int second = 1 - first;

    /* 5) 선공 실행 → 후공 실행 (후공 개체가 기절하면 생략) */
    execute_action(st, first, fa, rng, log);
    if (st->mon[second].cur_hp > 0) {
        execute_action(st, second, sa, rng, log);
    }

    /* 6) 턴 종료 효과 (양측, 낮은 side 부터) */
    end_of_turn_status(st, 0, rng, log);
    end_of_turn_status(st, 1, rng, log);

    /* 7) 되돌이 판정 (턴종료 타이밍일 때만; 즉시 타이밍은 이미 처리됨) */
    if (!st->awaken.immediate) {
        check_awaken(&st->mon[0], 0, log, &st->awaken);
        if (st->mon[0].awakened) st->awakened_ever[0] = true;
        check_awaken(&st->mon[1], 1, log, &st->awaken);
        if (st->mon[1].awakened) st->awakened_ever[1] = true;
    }

    /* 8) 기절 처리 */
    bool f0 = st->mon[0].cur_hp <= 0;
    bool f1 = st->mon[1].cur_hp <= 0;
    if (f0) log_faint(log, 0);
    if (f1) log_faint(log, 1);
    if (f0 || f1) {
        st->over = true;
        if (f0 && f1)      st->winner = -1;
        else if (f0)       st->winner = 1;
        else               st->winner = 0;
        log_end(log, st->winner);
        return;
    }

    /* 헤드리스 안전 상한: 무한 교착 방지 (T1-5). */
    if (st->turn >= MAX_BATTLE_TURNS) {
        st->over = true;
        st->winner = -1;   /* 시간초과 무승부 */
        log_end(log, st->winner);
    }
}

Action ai_choose(const BattleState* st, int side) {
    /* 결정론 AI: 선택 가능한 스킬 중 대략적 기대 데미지가 최대인 것.
     * 전투 RNG 를 소비하지 않는다 (골든/재현성 유지). */
    const BattleMon* atk = &st->mon[side];
    const BattleMon* def = &st->mon[1 - side];
    int best_slot = -1;
    long best_score = -1;
    int first_selectable = -1;

    for (int i = 0; i < MOVES_PER_MON; i++) {
        if (!battle_move_selectable(atk, i)) continue;
        if (first_selectable < 0) first_selectable = i;
        const Move* mv = move_get(atk->move_id[i]);
        if (mv->power == 0) continue;   /* 변화기는 점수 0 */
        int mvt = move_type(mv);
        long score = mv->power;
        /* 자속 */
        if (atk->type1 == mvt || (atk->type2 != TYPE_NONE && atk->type2 == mvt))
            score = score * STAB_NUM / STAB_DEN;
        /* 상성 (4분모) */
        int eff = EFF_DEN;
        eff = eff * g_eff_table[chart_get(mvt, def->type1)] / EFF_DEN;
        if (def->type2 != TYPE_NONE)
            eff = eff * g_eff_table[chart_get(mvt, def->type2)] / EFF_DEN;
        score = score * eff / EFF_DEN;
        /* 공격 스탯 반영 (물리/특수) */
        score = score * (move_class(mv) == CLASS_PHYSICAL
                         ? atk->stat[STAT_ATK] : atk->stat[STAT_SPA]);
        if (score > best_score) { best_score = score; best_slot = i; }
    }

    Action a;
    a.move_slot = (best_slot >= 0) ? best_slot
                 : (first_selectable >= 0 ? first_selectable : 0);
    return a;
}
