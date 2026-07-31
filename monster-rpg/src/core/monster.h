/* monster.h — 개체 구조/생성/스탯 (SPEC 5-1, 5-2, 6-1, 6-2) */
#ifndef MRPG_CORE_MONSTER_H
#define MRPG_CORE_MONSTER_H

#include "types.h"
#include "config.h"
#include "rng.h"

/* 유전자 언팩 (SPEC 5-2) */
#define GENE_DOM(b)  ((b) & 0x0F)
#define GENE_REC(b)  (((b) >> 4) & 0x0F)

/* 논리 개체. 직렬화 레이아웃(34바이트)과 별개다 (SPEC 5-1 주석). */
typedef struct {
    uint16_t instance_id;
    uint16_t species_id;
    uint16_t nickname_index;
    uint8_t  level;
    uint32_t exp;               /* u24 로 저장 */
    uint8_t  genes[STAT_COUNT]; /* HP,공,방,특공,특방,스피드 순 */
    uint8_t  nature;            /* 0~11 */
    uint8_t  ability;           /* 0~63 */
    uint8_t  gender;            /* 0 수 / 1 암 */
    bool     is_mutant;
    bool     gene_tested;
    bool     is_egg;
    uint8_t  move_id[MOVES_PER_MON];
    uint8_t  move_pp[MOVES_PER_MON];
    uint16_t cur_hp;
    uint8_t  status_type;       /* 3bit */
    uint8_t  status_counter;    /* 5bit */
    uint8_t  friendship;
    uint16_t parents[2];
} Monster;

/* --- 개체값 파생 (SPEC 6-1) --- */
int iv_normal(uint8_t gene_byte);    /* 평상시: 우성 기준 */
int iv_awakened(uint8_t gene_byte);  /* 되돌이: 열성 기준 */

/* --- 스탯 계산 (SPEC 6-2) --- */
int calc_hp(int base, int iv, int level);
int calc_stat(int base, int iv, int level, int nature_num); /* nature_num: 9/10/11 */

/* 성격 i 능력치 보정 배율의 분자 (9/10/11) 반환.
 * i 는 STAT_* (1~5). HP(0) 는 항상 10. */
int nature_num_for(uint8_t nature, int stat_index);

/* --- 유전자 조건 (SPEC 5-5) --- */
bool gene_cond_met(const Monster* m, uint8_t cond);

/* --- 직렬화 (SPEC 5-1) — 정확히 34바이트, 리틀 엔디언 --- */
void monster_serialize(const Monster* m, uint8_t out[MONSTER_SERIALIZED_SIZE]);
void monster_deserialize(Monster* m, const uint8_t in[MONSTER_SERIALIZED_SIZE]);

/* --- 개체 생성 (SPEC 5-4 / T1-2) --- */
/* 야생 개체: 우성 0~7, 열성 0~15, 성격 랜덤, 특성 0, 스킬 종별 고정. */
Monster wild_generate(Rng* rng, uint16_t species_id, uint8_t level);
/* 디버그: 유전자/성격을 직접 지정. 스킬은 종별 고정 목록. */
Monster debug_make(uint16_t species_id, uint8_t level,
                   const uint8_t genes[STAT_COUNT], uint8_t nature);

/* 종별 고정 스킬 4개를 out 에 채운다 (SPEC T1-2 "종별 고정 목록").
 * ※ SPEC 이 종별 스킬 목록을 명시하지 않아 구현에서 정한 배정이다.
 *   PROGRESS.md 의 "미확정 데이터" 항목 참조. */
void species_default_moves(uint16_t species_id, uint8_t out[MOVES_PER_MON]);

#endif /* MRPG_CORE_MONSTER_H */
