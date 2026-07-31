/* test_typechart.c — 상성표 4×4 전 조합 검증 (SPEC T1-4, 5-6) */
#include "test.h"
#include "typechart.h"

void test_typechart(void) {
    /* SPEC 5-6 P1 데이터. [공격][방어], 값 0=×0 1=×0.5 2=×1 3=×2.
     * 타입: 0 화 / 1 수 / 2 목 / 3 토. */
    static const int expected[4][4] = {
        /* 화 → */ {2, 1, 3, 1},
        /* 수 → */ {3, 2, 1, 3},
        /* 목 → */ {1, 3, 2, 3},
        /* 토 → */ {2, 1, 1, 2}
    };
    for (int a = 0; a < 4; a++) {
        for (int d = 0; d < 4; d++) {
            char label[48];
            snprintf(label, sizeof(label), "chart[%d][%d]", a, d);
            CHECK_EQ(chart_get(a, d), expected[a][d], label);
        }
    }
}
