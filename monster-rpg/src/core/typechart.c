/* typechart.c — 상성표 (SPEC 5-6) */
#include "typechart.h"

uint8_t g_typechart[TYPECHART_SIZE];

const int g_eff_table[4] = { 0, 2, 4, 8 };

int chart_get(int attack_type, int defend_type) {
    int index = attack_type * TYPE_COUNT + defend_type;
    int byte = index / 4;
    int shift = (index % 4) * 2;
    return (g_typechart[byte] >> shift) & 0x03;
}
