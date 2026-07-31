/* test.h — 최소 테스트 하네스 (SPEC T0-8, 외부 프레임워크 금지) */
#ifndef MRPG_TEST_H
#define MRPG_TEST_H

#include <stdio.h>

extern int g_tests_run;
extern int g_tests_failed;

#define CHECK(cond, label) do { \
    g_tests_run++; \
    if (!(cond)) { g_tests_failed++; \
        printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, (label)); } \
} while (0)

#define CHECK_EQ(a, b, label) do { \
    g_tests_run++; \
    long _a = (long)(a), _b = (long)(b); \
    if (_a != _b) { g_tests_failed++; \
        printf("  FAIL %s:%d  %s: got %ld, expected %ld\n", \
               __FILE__, __LINE__, (label), _a, _b); } \
} while (0)

void test_rng(void);
void test_schema(void);
void test_stats(void);
void test_typechart(void);
void test_damage(void);
void test_awaken(void);
void test_audio(void);

#endif /* MRPG_TEST_H */
