/* config.h — 모든 상수/매직넘버 (철칙 4)
 * 숫자 리터럴은 여기에 이름을 붙인다. 예외는 0,1,2 와 비트 마스크뿐이다. */
#ifndef MRPG_CORE_CONFIG_H
#define MRPG_CORE_CONFIG_H

/* 레벨 범위 (SPEC 5-1) */
#define LEVEL_MIN 1
#define LEVEL_MAX 150

/* 스탯 계산 (SPEC 6-2)
 * 성격 보정은 10분모 정수: 하락 9 / 중립 10 / 상승 11 */
#define NATURE_DEN 10
#define NATURE_DOWN 9
#define NATURE_NEUTRAL 10
#define NATURE_UP 11
#define STAT_LEVEL_DIV 100
#define HP_BONUS 10
#define STAT_BONUS 5
#define NATURE_COUNT 12

/* 데미지 계산 (SPEC 6-3) */
#define DMG_LEVEL_MUL 2
#define DMG_LEVEL_DIV 5
#define DMG_LEVEL_ADD 2
#define DMG_BASE_DIV 50
#define DMG_BASE_ADD 2
#define STAB_NUM 3        /* 자속 ×3/2 */
#define STAB_DEN 2
#define EFF_DEN 4         /* 상성 배율 4분모 (SPEC 6-3 (3)) */
#define CRIT_NUM 3        /* 급소 ×3/2 */
#define CRIT_DEN 2
#define CRIT_RATE_DEN 16  /* 급소 1/16 */
#define BURN_PHYS_DIV 2   /* 화상 시 물리 ×1/2 */
#define DMG_RAND_MIN 85   /* 난수 85~100 */
#define DMG_RAND_SPAN 16  /* rng_range(16) → 0~15, +85 → 85~100 */
#define DMG_RAND_DIV 100
#define DMG_MIN 1         /* 하한 */

/* 명중 판정 (SPEC 6-4) */
#define ACCURACY_ALWAYS 100  /* 이 값 초과면 필중 (명중 101) */
#define ACCURACY_DEN 100

/* 되돌이 판정 (SPEC 6-5). 기본 임계 25% = 1/4 */
#define AWAKEN_THRESHOLD_NUM 1
#define AWAKEN_THRESHOLD_DEN 4
#define AWAKEN_EARLY_NUM 2   /* 조기회귀 40% = 2/5 */
#define AWAKEN_EARLY_DEN 5
#define AWAKEN_LATE_NUM 3    /* 만성회귀 15% = 3/20 */
#define AWAKEN_LATE_DEN 20

/* 상태이상 지속 데미지 (SPEC 7장 / T1-7) */
#define BURN_TICK_DIV 16   /* 화상: 최대HP 1/16 */
#define POISON_TICK_DIV 8  /* 독: 최대HP 1/8 */

/* 개체 생성 (SPEC 5-4 / T1-2) */
#define WILD_DOM_MAX 8     /* 초반 우성 0~7 → rng_range(8) */
#define GENE_VAL_MAX 16    /* 열성 0~15 → rng_range(16) */
#define MOVES_PER_MON 4

/* 고정 크기 배열 상한 (동적 할당 금지, SPEC 11장) */
#define MAX_SPECIES 256
#define MAX_MOVES 256
#define STRING_POOL_MAX 4096
#define BATTLE_LOG_MAX 65536  /* 전투 로그 버퍼. 초기화 시점에만 잡는다 */
#define MAX_BATTLE_TURNS 100  /* 헤드리스 안전 상한 (T1-5 완료조건) */

/* 개체 직렬화 크기 (SPEC 5-1) */
#define MONSTER_SERIALIZED_SIZE 34
#define SPECIES_SERIALIZED_SIZE 20
#define MOVE_SERIALIZED_SIZE 9
#define TYPECHART_SIZE 16

#endif /* MRPG_CORE_CONFIG_H */
