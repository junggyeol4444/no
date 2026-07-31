/* species.h — 종 데이터 접근 (SPEC 5-3) */
#ifndef MRPG_CORE_SPECIES_H
#define MRPG_CORE_SPECIES_H

#include "types.h"
#include "config.h"

typedef struct {
    uint16_t name_index;
    uint8_t  type1;
    uint8_t  type2;          /* 255 = 없음 */
    uint8_t  base_stats[STAT_COUNT];
    uint8_t  catch_rate;
    uint8_t  base_exp;
    uint8_t  exp_curve;      /* 0 빠름 / 1 보통 / 2 느림 */
    uint8_t  breed_group;
    uint8_t  gender_ratio;
    uint8_t  hatch_tier;
    uint16_t learnset_offset;
    uint16_t ability_pool;
} Species;

/* 데이터 저장소. 로더가 채운다. species_id 0 은 빈 슬롯. */
typedef struct {
    Species entries[MAX_SPECIES];
    int count;
} SpeciesTable;

extern SpeciesTable g_species;

const Species* species_get(uint16_t id);   /* 없으면 NULL */

#endif /* MRPG_CORE_SPECIES_H */
