/* test_rng.c — 결정론 RNG 검사 (SPEC 9-1) */
#include "test.h"
#include "rng.h"

void test_rng(void) {
    /* 같은 시드 → 같은 수열 (10,000회) */
    Rng a, b;
    rng_seed(&a, 12345, RNG_BATTLE);
    rng_seed(&b, 12345, RNG_BATTLE);
    int same = 1;
    for (int i = 0; i < 10000; i++)
        if (rng_next(&a) != rng_next(&b)) { same = 0; break; }
    CHECK(same, "같은 시드는 같은 수열");

    /* 다른 시드 → 다른 수열 */
    Rng c;
    rng_seed(&a, 12345, RNG_BATTLE);
    rng_seed(&c, 999, RNG_BATTLE);
    int diff = 0;
    for (int i = 0; i < 10000; i++)
        if (rng_next(&a) != rng_next(&c)) { diff = 1; break; }
    CHECK(diff, "다른 시드는 다른 수열");

    /* rng_range 결과가 항상 [0, n) */
    rng_seed(&a, 42, RNG_BATTLE);
    int in_bounds = 1;
    for (int i = 0; i < 100000; i++) {
        uint32_t v = rng_range(&a, 7);
        if (v >= 7) { in_bounds = 0; break; }
    }
    CHECK(in_bounds, "rng_range 는 [0,n) 범위");

    /* 분포 편향 검사 (n=3, 100만회, 각 구간 33.3% ±0.5%) */
    rng_seed(&a, 7, RNG_BATTLE);
    long cnt[3] = {0, 0, 0};
    long N = 1000000;
    for (long i = 0; i < N; i++) cnt[rng_range(&a, 3)]++;
    long lo = N / 3 - N / 200;   /* -0.5% */
    long hi = N / 3 + N / 200;   /* +0.5% */
    int dist_ok = 1;
    for (int k = 0; k < 3; k++)
        if (cnt[k] < lo || cnt[k] > hi) dist_ok = 0;
    CHECK(dist_ok, "n=3 분포가 33.3% ±0.5% 이내");
}
