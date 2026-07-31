/* synth.h — 런타임 오디오 합성기 (SPEC T0-6, 26-6).
 * 파형 4종(구형파 2·삼각 1·노이즈 1), 채널 4개, 정수 PCM 출력.
 * core/data 밖의 모듈이라 부동소수점 제약과 무관하나, 정수로 구현했다. */
#ifndef MRPG_AUDIO_SYNTH_H
#define MRPG_AUDIO_SYNTH_H

#include <stdint.h>

enum { WAVE_SQUARE_A = 0, WAVE_SQUARE_B = 1, WAVE_TRIANGLE = 2, WAVE_NOISE = 3 };

/* 음표: 3바이트 (SPEC 26-6 "음정·길이·음량"). 곡 데이터를 작게 유지. */
typedef struct {
    uint8_t pitch;   /* 0 = 쉼표. 그 외 60 = C4 기준 반음 오프셋 */
    uint8_t length;  /* 길이 (1/8 박 단위) */
    uint8_t volume;  /* 0~15 */
} Note;

typedef struct {
    const Note* notes;
    int         count;
    uint8_t     wave;   /* WAVE_* */
} Track;

typedef struct {
    const Track* tracks;
    int          track_count;   /* 최대 4 */
} Song;

/* 곡을 모노 16bit PCM 으로 렌더링. 반환: 실제 쓴 샘플 수. */
int synth_render(const Song* song, int16_t* out, int max_samples, int sample_rate);

/* 테스트/데모용 짧은 곡 (SPEC T0-6 "테스트용 짧은 곡 1개"). */
extern const Song g_song_test;
int song_test_byte_size(void);   /* 곡 데이터 바이트 수 (2KB 이하 검증용) */

#endif /* MRPG_AUDIO_SYNTH_H */
