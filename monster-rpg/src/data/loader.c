/* loader.c — 바이너리 로더 (SPEC T0-4).
 * 표준 stdio 만 사용 (raylib 무의존, 철칙 1). */
#include "loader.h"
#include "schema.h"
#include "../core/species.h"
#include "../core/moves.h"
#include "../core/typechart.h"
#include <stdio.h>
#include <string.h>

StringTable g_strings;

const char* string_get(uint16_t index) {
    if (index >= g_strings.count) return "";
    return g_strings.pool + g_strings.offset[index];
}

static uint16_t rd_u16(const uint8_t* p) { return (uint16_t)(p[0] | (p[1] << 8)); }

/* 파일 전체를 buf 로 읽는다. 반환 = 읽은 바이트 수, 음수 = 실패. */
static long read_file(const char* path, uint8_t* buf, long cap) {
    FILE* f = fopen(path, "rb");
    if (!f) return -1;
    long n = (long)fread(buf, 1, (size_t)cap, f);
    fclose(f);
    return n;
}

int load_species(const char* path) {
    static uint8_t buf[2 + MAX_SPECIES * SPECIES_SERIALIZED_SIZE];
    long n = read_file(path, buf, (long)sizeof(buf));
    if (n < 2) return -1;
    int count = rd_u16(buf);
    if (count <= 0 || count >= MAX_SPECIES) return -2;
    if (n < 2 + (long)count * SPECIES_SERIALIZED_SIZE) return -3;

    memset(&g_species, 0, sizeof(g_species));
    g_species.count = count;
    for (int i = 0; i < count; i++) {
        const uint8_t* r = buf + 2 + i * SPECIES_SERIALIZED_SIZE;
        Species* s = &g_species.entries[i + 1];   /* id = i+1 */
        s->name_index = rd_u16(r + 0);
        s->type1 = r[2];
        s->type2 = r[3];
        for (int k = 0; k < STAT_COUNT; k++) s->base_stats[k] = r[4 + k];
        s->catch_rate = r[10];
        s->base_exp = r[11];
        s->exp_curve = r[12];
        s->breed_group = r[13];
        s->gender_ratio = r[14];
        s->hatch_tier = r[15];
        s->learnset_offset = rd_u16(r + 16);
        s->ability_pool = rd_u16(r + 18);
    }
    return 0;
}

int load_moves(const char* path) {
    static uint8_t buf[2 + MAX_MOVES * MOVE_SERIALIZED_SIZE];
    long n = read_file(path, buf, (long)sizeof(buf));
    if (n < 2) return -1;
    int count = rd_u16(buf);
    if (count <= 0 || count >= MAX_MOVES) return -2;
    if (n < 2 + (long)count * MOVE_SERIALIZED_SIZE) return -3;

    memset(&g_moves, 0, sizeof(g_moves));
    g_moves.count = count;
    for (int i = 0; i < count; i++) {
        const uint8_t* r = buf + 2 + i * MOVE_SERIALIZED_SIZE;
        Move* mv = &g_moves.entries[i + 1];   /* id = i+1 */
        mv->name_index = rd_u16(r + 0);
        mv->type_class = r[2];
        mv->priority = r[3];
        mv->power = r[4];
        mv->accuracy = r[5];
        mv->pp = r[6];
        mv->effect_id = r[7];
        mv->gene_cond = r[8];
    }
    return 0;
}

int load_typechart(const char* path) {
    uint8_t buf[TYPECHART_SIZE];
    long n = read_file(path, buf, (long)sizeof(buf));
    if (n < TYPECHART_SIZE) return -1;
    memcpy(g_typechart, buf, TYPECHART_SIZE);
    return 0;
}

int load_strings(const char* path) {
    static uint8_t buf[STRING_POOL_MAX + MAX_STRINGS * 2 + 2];
    long n = read_file(path, buf, (long)sizeof(buf));
    if (n < 2) return -1;
    int count = rd_u16(buf);
    if (count < 0 || count > MAX_STRINGS) return -2;

    memset(&g_strings, 0, sizeof(g_strings));
    g_strings.count = count;
    long pos = 2;
    for (int i = 0; i < count; i++) {
        if (pos + 2 > n) return -3;
        uint16_t len = rd_u16(buf + pos);
        pos += 2;
        if (pos + len > n) return -3;
        if (g_strings.pool_len + len + 1 > STRING_POOL_MAX) return -4;
        g_strings.offset[i] = (uint32_t)g_strings.pool_len;
        g_strings.length[i] = len;
        memcpy(g_strings.pool + g_strings.pool_len, buf + pos, len);
        g_strings.pool_len += len;
        g_strings.pool[g_strings.pool_len++] = '\0';   /* 널 종료 */
        pos += len;
    }
    return 0;
}

int data_load_all(const char* dir) {
    char path[512];
    int rc;
    snprintf(path, sizeof(path), "%s/%s", dir, DATA_FILE_STRINGS);
    if ((rc = load_strings(path)) != 0) return -100 + rc;
    snprintf(path, sizeof(path), "%s/%s", dir, DATA_FILE_SPECIES);
    if ((rc = load_species(path)) != 0) return -200 + rc;
    snprintf(path, sizeof(path), "%s/%s", dir, DATA_FILE_MOVES);
    if ((rc = load_moves(path)) != 0) return -300 + rc;
    snprintf(path, sizeof(path), "%s/%s", dir, DATA_FILE_TYPECHART);
    if ((rc = load_typechart(path)) != 0) return -400 + rc;
    return 0;
}
