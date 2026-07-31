/* test_audio.c — 오디오 합성기 검사 (SPEC T0-6) */
#include "test.h"
#include "synth.h"

static int16_t s_buf[22050 * 8];   /* 최대 8초 */

void test_audio(void) {
    int n = synth_render(&g_song_test, s_buf,
                         (int)(sizeof(s_buf) / sizeof(s_buf[0])), 22050);
    CHECK(n > 0, "곡이 렌더링됨");

    int nonzero = 0;
    for (int i = 0; i < n; i++) if (s_buf[i] != 0) { nonzero++; }
    CHECK(nonzero > 0, "곡이 무음이 아님");

    /* 곡 데이터가 2KB 이하 (SPEC T0-6 완료조건) */
    int sz = song_test_byte_size();
    CHECK(sz <= 2048, "곡 데이터 2KB 이하");
    printf("  (곡 데이터 %d바이트, 렌더 %d샘플)\n", sz, n);
}
