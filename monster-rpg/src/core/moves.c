/* moves.c — 스킬 데이터 접근 (SPEC 5-4) */
#include "moves.h"

MoveTable g_moves;

const Move* move_get(uint8_t id) {
    /* move_id 는 1-기반. id 0 = 빈 슬롯. id 는 u8 이라 MAX_MOVES(256) 미만 보장. */
    if (id == 0 || id > g_moves.count) return NULL;
    return &g_moves.entries[id];
}
