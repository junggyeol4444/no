/* test_schema.c — 직렬화 왕복 검사 (SPEC T0-4).
 * 직렬화 결과가 정확히 34바이트, 왕복 후 모든 필드 동일. */
#include "test.h"
#include "monster.h"
#include <string.h>

void test_schema(void) {
    Monster m;
    memset(&m, 0, sizeof(m));
    m.instance_id = 0x1234;
    m.species_id = 3;
    m.nickname_index = 0xABCD;
    m.level = 77;
    m.exp = 0x123456;            /* u24 경계값 */
    for (int i = 0; i < STAT_COUNT; i++) m.genes[i] = (uint8_t)(0x10 + i);
    m.nature = 11;              /* 4bit 최대 근처 */
    m.ability = 42;            /* 6bit */
    m.gender = 1;
    m.is_mutant = true;
    m.gene_tested = true;
    m.is_egg = false;
    for (int i = 0; i < MOVES_PER_MON; i++) {
        m.move_id[i] = (uint8_t)(i + 1);
        m.move_pp[i] = (uint8_t)(30 - i);
    }
    m.cur_hp = 0xBEEF;
    m.status_type = STATUS_POISON;    /* 3 */
    m.status_counter = 17;           /* 5bit */
    m.friendship = 200;
    m.parents[0] = 0x1111;
    m.parents[1] = 0x2222;

    uint8_t buf[MONSTER_SERIALIZED_SIZE];
    /* 버퍼 크기가 정확히 34인지 컴파일 타임 확인 */
    CHECK_EQ(sizeof(buf), 34, "직렬화 버퍼 34바이트");
    monster_serialize(&m, buf);

    Monster r;
    monster_deserialize(&r, buf);

    CHECK_EQ(r.instance_id, m.instance_id, "instance_id");
    CHECK_EQ(r.species_id, m.species_id, "species_id");
    CHECK_EQ(r.nickname_index, m.nickname_index, "nickname_index");
    CHECK_EQ(r.level, m.level, "level");
    CHECK_EQ(r.exp, m.exp, "exp (u24)");
    int genes_ok = 1;
    for (int i = 0; i < STAT_COUNT; i++) if (r.genes[i] != m.genes[i]) genes_ok = 0;
    CHECK(genes_ok, "genes 6바이트");
    CHECK_EQ(r.nature, m.nature, "nature");
    CHECK_EQ(r.ability, m.ability, "ability");
    CHECK_EQ(r.gender, m.gender, "gender");
    CHECK(r.is_mutant == m.is_mutant, "is_mutant");
    CHECK(r.gene_tested == m.gene_tested, "gene_tested");
    CHECK(r.is_egg == m.is_egg, "is_egg");
    int moves_ok = 1;
    for (int i = 0; i < MOVES_PER_MON; i++)
        if (r.move_id[i] != m.move_id[i] || r.move_pp[i] != m.move_pp[i]) moves_ok = 0;
    CHECK(moves_ok, "moves 4×2");
    CHECK_EQ(r.cur_hp, m.cur_hp, "cur_hp");
    CHECK_EQ(r.status_type, m.status_type, "status_type");
    CHECK_EQ(r.status_counter, m.status_counter, "status_counter");
    CHECK_EQ(r.friendship, m.friendship, "friendship");
    CHECK_EQ(r.parents[0], m.parents[0], "parents[0]");
    CHECK_EQ(r.parents[1], m.parents[1], "parents[1]");
}
