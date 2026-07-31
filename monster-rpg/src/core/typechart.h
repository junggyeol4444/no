/* typechart.h — 상성표 (SPEC 5-6)
 * 8×8 = 64칸, 칸당 2bit. 값 0=×0.0 / 1=×0.5 / 2=×1.0 / 3=×2.0 */
#ifndef MRPG_CORE_TYPECHART_H
#define MRPG_CORE_TYPECHART_H

#include "types.h"
#include "config.h"

extern uint8_t g_typechart[TYPECHART_SIZE];

/* 2bit 셀 값 반환 (0~3). index = attack*8 + defend */
int chart_get(int attack_type, int defend_type);

/* 셀 값 → 4분모 배율 분자 (SPEC 6-3 (3)): {0,2,4,8} */
extern const int g_eff_table[4];

#endif /* MRPG_CORE_TYPECHART_H */
