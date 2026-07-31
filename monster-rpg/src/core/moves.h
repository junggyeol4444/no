/* moves.h — 스킬 데이터 접근 (SPEC 5-4) */
#ifndef MRPG_CORE_MOVES_H
#define MRPG_CORE_MOVES_H

#include "types.h"
#include "config.h"

#define MOVE_PRIORITY_BIAS 8   /* 우선도 저장 오프셋 (SPEC 5-4) */

typedef struct {
    uint16_t name_index;
    uint8_t  type_class;   /* 타입 4bit + 분류 2bit + 예약 2bit */
    uint8_t  priority;     /* +8 오프셋 저장 (실제 -3~+3) */
    uint8_t  power;        /* 0 = 변화기 */
    uint8_t  accuracy;     /* 101 = 필중 */
    uint8_t  pp;
    uint8_t  effect_id;
    uint8_t  gene_cond;    /* 유전자 조건 (SPEC 5-5) */
} Move;

typedef struct {
    Move entries[MAX_MOVES];
    int count;
} MoveTable;

extern MoveTable g_moves;

const Move* move_get(uint8_t id);          /* 없으면 NULL */

/* 필드 접근 헬퍼 — type_class 언팩 (SPEC 5-4) */
static inline int move_type(const Move* mv)  { return mv->type_class & 0x0F; }
static inline int move_class(const Move* mv) { return (mv->type_class >> 4) & 0x03; }
static inline int move_priority(const Move* mv) {
    return (int)mv->priority - MOVE_PRIORITY_BIAS;
}

#endif /* MRPG_CORE_MOVES_H */
