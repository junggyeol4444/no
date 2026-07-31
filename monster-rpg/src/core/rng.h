/* rng.h — 결정론 난수 (SPEC 4장). 표준 라이브러리 전역 난수 사용 금지 (철칙 3).
 * RNG 상태는 항상 인자로 전달한다. */
#ifndef MRPG_CORE_RNG_H
#define MRPG_CORE_RNG_H

#include "types.h"

typedef struct { uint64_t state; uint64_t inc; } Rng;

/* 스트림 분리 (SPEC 4-2). 용도별로 독립 시퀀스를 쓴다. */
enum {
    RNG_BATTLE = 1,    /* 전투 판정 */
    RNG_ENCOUNTER = 2, /* 야생 조우/개체 생성 */
    RNG_BREED = 3      /* 브리딩 (P2 이후) */
};

void     rng_seed(Rng* r, uint64_t seed, uint64_t seq);
uint32_t rng_next(Rng* r);                 /* [0, 2^32) */
uint32_t rng_range(Rng* r, uint32_t n);    /* [0, n), modulo 편향 제거 */
bool     rng_chance(Rng* r, uint32_t num, uint32_t den); /* num/den 확률 */

#endif /* MRPG_CORE_RNG_H */
