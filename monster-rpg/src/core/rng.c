/* rng.c — PCG32 직접 구현 (SPEC 4-1).
 * 참조: pcg-random.org minimal C implementation (공개 알고리즘). */
#include "rng.h"

/* PCG32 LCG 곱수 (알고리즘 상수) */
static const uint64_t PCG_MULT = 6364136223846793005ULL;

uint32_t rng_next(Rng* r) {
    uint64_t old = r->state;
    r->state = old * PCG_MULT + r->inc;
    /* 왜 이 시프트/회전인가: PCG32 의 출력 순열(XSH-RR). 상태 상위 비트를
     * 섞어 통계 품질을 확보한다. 상수를 바꾸면 수열이 달라진다. */
    uint32_t xorshifted = (uint32_t)(((old >> 18u) ^ old) >> 27u);
    uint32_t rot = (uint32_t)(old >> 59u);
    return (xorshifted >> rot) | (xorshifted << ((0u - rot) & 31u));
}

void rng_seed(Rng* r, uint64_t seed, uint64_t seq) {
    r->state = 0u;
    r->inc = (seq << 1u) | 1u;   /* inc 는 항상 홀수여야 한다 */
    (void)rng_next(r);
    r->state += seed;
    (void)rng_next(r);
}

uint32_t rng_range(Rng* r, uint32_t n) {
    /* rejection sampling 으로 modulo 편향 제거 (SPEC 4-1).
     * threshold = 2^32 mod n. threshold 미만 값은 버린다. */
    uint32_t threshold = (0u - n) % n;
    for (;;) {
        uint32_t v = rng_next(r);
        if (v >= threshold) return v % n;
    }
}

bool rng_chance(Rng* r, uint32_t num, uint32_t den) {
    return rng_range(r, den) < num;
}
