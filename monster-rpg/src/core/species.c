/* species.c — 종 데이터 접근 (SPEC 5-3) */
#include "species.h"

SpeciesTable g_species;

const Species* species_get(uint16_t id) {
    /* 종 ID 는 1-기반. entries[id] 가 해당 종이다 (entries[0] 미사용).
     * 로더가 id 1..count 를 연속으로 채운다. */
    if (id == 0 || id >= MAX_SPECIES) return NULL;
    if (id > g_species.count) return NULL;
    return &g_species.entries[id];
}
