/* battle.h — 전투 상태 기계 (SPEC 6-3~6-7, T1-5). raylib 무의존 (철칙 1). */
#ifndef MRPG_CORE_BATTLE_H
#define MRPG_CORE_BATTLE_H

#include "types.h"
#include "config.h"
#include "rng.h"
#include "monster.h"
#include "moves.h"
#include "battle_log.h"

/* 전투용 개체 — 계산된 스탯을 들고 있다. 개체 데이터(Monster)와 분리. */
typedef struct {
    uint16_t species_id;
    uint8_t  level;
    uint8_t  genes[STAT_COUNT];
    uint8_t  nature;
    uint8_t  ability;
    uint8_t  type1, type2;
    int      stat[STAT_COUNT];  /* stat[STAT_HP] 미사용, max_hp 사용 */
    int      max_hp;
    int      cur_hp;
    uint8_t  status_type;
    int      status_counter;
    bool     awakened;
    uint8_t  move_id[MOVES_PER_MON];
    uint8_t  move_pp[MOVES_PER_MON];
} BattleMon;

/* 데미지 부가 정보 (SPEC 6-3 out 인자) */
typedef struct {
    bool stab;
    bool crit;
    int  effectiveness;   /* eff_num: 0,1,2,4,8,16,32 형태 */
} DamageInfo;

/* 되돌이 튜닝 설정 (SPEC T1-11). 특성이 없는 개체에 적용되는 기본 임계. */
typedef struct {
    int  threshold_num;   /* 기본 AWAKEN_THRESHOLD_NUM */
    int  threshold_den;   /* 기본 AWAKEN_THRESHOLD_DEN */
    bool immediate;       /* false=턴종료(기본) / true=즉시 (SPEC 6-7 주석) */
} AwakenConfig;

typedef struct { int move_slot; } Action;

typedef struct {
    BattleMon    mon[2];
    int          turn;
    bool         over;
    int          winner;        /* 0/1, 무승부 -1 */
    bool         awakened_ever[2];  /* 통계용: 각 측이 전투 중 되돌이했는지 */
    AwakenConfig awaken;
} BattleState;

/* 기본 되돌이 설정 (임계 25%, 턴종료 발동). */
AwakenConfig awaken_config_default(void);

/* --- 스탯/개체 --- */
void recalc_stats(BattleMon* m);                     /* SPEC 6-6 */
void battlemon_init(BattleMon* bm, const Monster* m);/* Monster → BattleMon */

/* --- 판정 --- */
int  calc_damage(const BattleMon* atk, const BattleMon* def,
                 const Move* mv, Rng* rng, DamageInfo* out);   /* SPEC 6-3 */
bool check_hit(const Move* mv, Rng* rng);                      /* SPEC 6-4 */
void check_awaken(BattleMon* m, int side, BattleLog* log,
                  const AwakenConfig* cfg);                    /* SPEC 6-5 */

/* 스킬 슬롯이 지금 선택 가능한가: PP>0 AND 유전자 조건 AND (열성기면 되돌이 상태).
 * SPEC T1-8: 열성 조건 스킬은 되돌이 전에는 선택 불가. */
bool battle_move_selectable(const BattleMon* m, int slot);

/* --- 상태 기계 --- */
void battle_init(BattleState* st, const Monster* p0, const Monster* p1,
                 AwakenConfig cfg);
void battle_step(BattleState* st, Action a0, Action a1,
                 Rng* rng, BattleLog* log);           /* SPEC 6-7 한 턴 */

/* 자동 대전용 결정론 AI (전투 RNG 를 소비하지 않는다). */
Action ai_choose(const BattleState* st, int side);

#endif /* MRPG_CORE_BATTLE_H */
