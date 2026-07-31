/* monster.c — 개체 구조/생성/스탯 (SPEC 5-1, 5-2, 5-4, 5-5, 6-1, 6-2) */
#include "monster.h"
#include "species.h"
#include "moves.h"
#include <string.h>

/* 성격 테이블 (SPEC 6-2). 능력치 인덱스 1=공격 2=방어 3=특공 4=특방 5=스피드.
 * 해당 능력치가 상승 대상이면 11, 하락 대상이면 9, 아니면 10. */
static const uint8_t NATURE_UP_STAT[NATURE_COUNT]   = {1,1,1,2,2,3,3,4,4,5,5,5};
static const uint8_t NATURE_DOWN_STAT[NATURE_COUNT] = {3,2,4,1,3,2,5,3,5,2,4,1};

int iv_normal(uint8_t gene_byte) {
    int dom = GENE_DOM(gene_byte);
    int rec = GENE_REC(gene_byte);
    return dom * 2 + (dom == rec ? 1 : 0);   /* 0~31 (SPEC 6-1) */
}

int iv_awakened(uint8_t gene_byte) {
    int dom = GENE_DOM(gene_byte);
    int rec = GENE_REC(gene_byte);
    return rec * 2 + (dom == rec ? 1 : 0);   /* 0~31 (SPEC 6-1) */
}

int calc_hp(int base, int iv, int level) {
    /* SPEC 6-2. 연산 순서 고정: 정수 나눗셈 절삭 위치가 결과를 결정한다. */
    return (2 * base + iv) * level / STAT_LEVEL_DIV + level + HP_BONUS;
}

int calc_stat(int base, int iv, int level, int nature_num) {
    int v = (2 * base + iv) * level / STAT_LEVEL_DIV + STAT_BONUS;
    return v * nature_num / NATURE_DEN;   /* nature_num: 9,10,11 */
}

int nature_num_for(uint8_t nature, int stat_index) {
    if (stat_index <= STAT_HP || nature >= NATURE_COUNT) return NATURE_NEUTRAL;
    if (NATURE_UP_STAT[nature] == stat_index)   return NATURE_UP;
    if (NATURE_DOWN_STAT[nature] == stat_index) return NATURE_DOWN;
    return NATURE_NEUTRAL;
}

bool gene_cond_met(const Monster* m, uint8_t cond) {
    /* SPEC 5-5. 능력치 필드가 0이면 항상 true. */
    int stat = (cond >> 4) & 0x07;
    if (stat == 0) return true;
    int idx = stat - 1;   /* gene_cond 능력치(1~6) → 유전자 배열 인덱스(0~5) */
    int threshold = cond & 0x0F;
    int target_rec = (cond >> 7) & 0x01;
    int val = target_rec ? GENE_REC(m->genes[idx]) : GENE_DOM(m->genes[idx]);
    return val >= threshold;
}

/* --- 직렬화 헬퍼 (리틀 엔디언) --- */
static void put_u16(uint8_t* p, uint16_t v) { p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8); }
static uint16_t get_u16(const uint8_t* p) { return (uint16_t)(p[0] | (p[1] << 8)); }

void monster_serialize(const Monster* m, uint8_t out[MONSTER_SERIALIZED_SIZE]) {
    /* SPEC 5-1 레이아웃. 구조체 패딩에 의존하지 않고 바이트 단위로 쓴다. */
    memset(out, 0, MONSTER_SERIALIZED_SIZE);
    put_u16(out + 0, m->instance_id);
    put_u16(out + 2, m->species_id);
    put_u16(out + 4, m->nickname_index);
    out[6] = m->level;
    out[7] = (uint8_t)(m->exp & 0xFF);
    out[8] = (uint8_t)((m->exp >> 8) & 0xFF);
    out[9] = (uint8_t)((m->exp >> 16) & 0xFF);   /* u24 */
    memcpy(out + 10, m->genes, STAT_COUNT);
    uint16_t na = (uint16_t)((m->nature & 0x0F)
                | ((m->ability & 0x3F) << 4)
                | ((m->gender & 0x01) << 10)
                | ((m->is_mutant ? 1 : 0) << 11)
                | ((m->gene_tested ? 1 : 0) << 12)
                | ((m->is_egg ? 1 : 0) << 13));
    put_u16(out + 16, na);
    for (int i = 0; i < MOVES_PER_MON; i++) {
        out[18 + i * 2] = m->move_id[i];
        out[19 + i * 2] = m->move_pp[i];
    }
    put_u16(out + 26, m->cur_hp);
    out[28] = (uint8_t)((m->status_type & 0x07) | ((m->status_counter & 0x1F) << 3));
    out[29] = m->friendship;
    put_u16(out + 30, m->parents[0]);
    put_u16(out + 32, m->parents[1]);
}

void monster_deserialize(Monster* m, const uint8_t in[MONSTER_SERIALIZED_SIZE]) {
    memset(m, 0, sizeof(*m));
    m->instance_id = get_u16(in + 0);
    m->species_id = get_u16(in + 2);
    m->nickname_index = get_u16(in + 4);
    m->level = in[6];
    m->exp = (uint32_t)in[7] | ((uint32_t)in[8] << 8) | ((uint32_t)in[9] << 16);
    memcpy(m->genes, in + 10, STAT_COUNT);
    uint16_t na = get_u16(in + 16);
    m->nature      = (uint8_t)(na & 0x0F);
    m->ability     = (uint8_t)((na >> 4) & 0x3F);
    m->gender      = (uint8_t)((na >> 10) & 0x01);
    m->is_mutant   = ((na >> 11) & 0x01) != 0;
    m->gene_tested = ((na >> 12) & 0x01) != 0;
    m->is_egg      = ((na >> 13) & 0x01) != 0;
    for (int i = 0; i < MOVES_PER_MON; i++) {
        m->move_id[i] = in[18 + i * 2];
        m->move_pp[i] = in[19 + i * 2];
    }
    m->cur_hp = get_u16(in + 26);
    m->status_type    = (uint8_t)(in[28] & 0x07);
    m->status_counter = (uint8_t)((in[28] >> 3) & 0x1F);
    m->friendship = in[29];
    m->parents[0] = get_u16(in + 30);
    m->parents[1] = get_u16(in + 32);
}

void species_default_moves(uint16_t species_id, uint8_t out[MOVES_PER_MON]) {
    /* ※ SPEC 이 종별 스킬 목록을 주지 않아 구현에서 배정한 값이다.
     *   각 종에 자속기 + 조건기 + 되돌이 전용기(ID 8)를 넣어
     *   되돌이 프로토타입을 검증 가능하게 했다. PROGRESS.md 참조. */
    switch (species_id) {
        case 1: /* 불꽃도마뱀(화): 들이받기,불꽃송곳니,화염폭발,야성의송곳니 */
            out[0] = 1; out[1] = 2; out[2] = 6; out[3] = 8; break;
        case 2: /* 물뱀(수): 들이받기,물대포,단단해지기,야성의송곳니 */
            out[0] = 1; out[1] = 3; out[2] = 5; out[3] = 8; break;
        case 3: /* 새싹짐승(목): 들이받기,덩굴채찍,바위깨기,야성의송곳니 */
            out[0] = 1; out[1] = 4; out[2] = 7; out[3] = 8; break;
        default:
            out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; break;
    }
}

/* 종 기본 스킬을 개체에 채우고 PP 를 최대치로 설정. */
static void fill_moves(Monster* m) {
    species_default_moves(m->species_id, m->move_id);
    for (int i = 0; i < MOVES_PER_MON; i++) {
        const Move* mv = move_get(m->move_id[i]);
        m->move_pp[i] = mv ? mv->pp : 0;
    }
}

/* 현재 HP 를 평상시 최대치로 채운다 (생성 직후 만피). */
static void fill_full_hp(Monster* m) {
    const Species* sp = species_get(m->species_id);
    if (!sp) { m->cur_hp = 0; return; }
    m->cur_hp = (uint16_t)calc_hp(sp->base_stats[STAT_HP],
                                  iv_normal(m->genes[STAT_HP]), m->level);
}

Monster wild_generate(Rng* rng, uint16_t species_id, uint8_t level) {
    /* SPEC 5-4 / T1-2. RNG 소비 순서 고정(결정론): 유전자 6개(각 우성→열성),
     * 그 다음 성격. 순서를 바꾸면 같은 시드로도 다른 개체가 나온다. */
    Monster m;
    memset(&m, 0, sizeof(m));
    m.species_id = species_id;
    m.level = level;
    for (int i = 0; i < STAT_COUNT; i++) {
        int dom = (int)rng_range(rng, WILD_DOM_MAX);   /* 0~7 */
        int rec = (int)rng_range(rng, GENE_VAL_MAX);   /* 0~15 */
        m.genes[i] = (uint8_t)((dom & 0x0F) | ((rec & 0x0F) << 4));
    }
    m.nature = (uint8_t)rng_range(rng, NATURE_COUNT);
    m.ability = ABILITY_NONE;   /* P1 고정 (SPEC T1-2) */
    m.gender = 0;
    fill_moves(&m);
    fill_full_hp(&m);
    return m;
}

Monster debug_make(uint16_t species_id, uint8_t level,
                   const uint8_t genes[STAT_COUNT], uint8_t nature) {
    Monster m;
    memset(&m, 0, sizeof(m));
    m.species_id = species_id;
    m.level = level;
    memcpy(m.genes, genes, STAT_COUNT);
    m.nature = nature;
    m.ability = ABILITY_NONE;
    fill_moves(&m);
    fill_full_hp(&m);
    return m;
}
