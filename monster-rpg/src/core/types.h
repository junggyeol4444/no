/* types.h — 공통 타입/열거형 정의 (SPEC 2, 5장)
 * core/ 는 raylib 을 모른다 (철칙 1). 여기에는 표준 헤더만 include 한다. */
#ifndef MRPG_CORE_TYPES_H
#define MRPG_CORE_TYPES_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* 능력치 인덱스 — 유전자 배열 순서와 동일 (SPEC 5-2)
 * 0 HP / 1 공격 / 2 방어 / 3 특수공격 / 4 특수방어 / 5 스피드
 * ※ 데미지식(SPEC 6-3)에서 특수방어는 STAT_SPD 로 참조된다. */
enum {
    STAT_HP = 0,
    STAT_ATK = 1,
    STAT_DEF = 2,
    STAT_SPA = 3,
    STAT_SPD = 4,   /* 특수방어 */
    STAT_SPE = 5,   /* 스피드 */
    STAT_COUNT = 6
};

/* 타입 인덱스 (SPEC 5-6). P1 은 0~3 만 사용한다. */
enum {
    TYPE_FIRE = 0,   /* 화 */
    TYPE_WATER = 1,  /* 수 */
    TYPE_WOOD = 2,   /* 목 */
    TYPE_EARTH = 3,  /* 토 */
    TYPE_METAL = 4,  /* 금 */
    TYPE_THUNDER = 5,/* 뇌 */
    TYPE_LIGHT = 6,  /* 광 */
    TYPE_DARK = 7,   /* 암 */
    TYPE_COUNT = 8,
    TYPE_NONE = 255  /* type2 없음 표기 (SPEC 5-3) */
};

/* 스킬 분류 (SPEC 5-4) */
enum {
    CLASS_PHYSICAL = 0, /* 물리 */
    CLASS_SPECIAL = 1,  /* 특수 */
    CLASS_STATUS = 2    /* 변화 */
};

/* 상태이상 종류 (SPEC 5-1 status 비트). P1 은 화상/독만 부여한다. */
enum {
    STATUS_NONE = 0,
    STATUS_BURN = 1,   /* 화상 */
    STATUS_PARALYZE = 2,
    STATUS_POISON = 3, /* 독 */
    STATUS_SLEEP = 4,
    STATUS_FREEZE = 5,
    STATUS_CONFUSE = 6
};

/* 특성 — P1 은 되돌이형 3종 + 없음만 구현한다 (SPEC 10장 스코프, 6-5). */
enum {
    ABILITY_NONE = 0,
    ABILITY_EARLY_RETURN = 1,  /* 조기회귀: 되돌이 임계 40% */
    ABILITY_LATE_RETURN = 2,   /* 만성회귀: 되돌이 임계 15% */
    ABILITY_REFUSE_RETURN = 3  /* 회귀거부: 되돌이 없음 */
};

#endif /* MRPG_CORE_TYPES_H */
