/* synth.c — 런타임 오디오 합성기 (SPEC T0-6) */
#include "synth.h"

#define LENGTH_UNIT_DIV 8    /* 길이 1 = sample_rate/8 샘플 (1/8박) */
#define AMP_PER_VOL 380      /* 음량 15 → ~5700 진폭 (4채널 합산 여유) */

/* C4~B4 주파수 (Hz, 정수). 옥타브는 비트 시프트로 이동. */
static const int BASE_FREQ[12] = {
    262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494
};

/* 음정(pitch) → 한 주기 샘플 수. pitch 60 = C4. 0 은 호출 안 함. */
static int period_for(int pitch, int sr) {
    int n = pitch - 60;                 /* C4 기준 반음 */
    int oct = n / 12, semi = n % 12;
    if (semi < 0) { semi += 12; oct -= 1; }
    int freq = BASE_FREQ[semi];
    if (oct >= 0) freq <<= oct; else freq >>= (-oct);
    if (freq <= 0) return 0;
    return sr / freq;
}

/* 포화 덧셈 (int16 클리핑). */
static int16_t sat_add(int16_t a, int v) {
    int s = (int)a + v;
    if (s > 32767) s = 32767;
    if (s < -32768) s = -32768;
    return (int16_t)s;
}

/* 한 파형의 표본값 (phase: 0..period-1). */
static int wave_sample(uint8_t wave, int phase, int period, int amp, uint32_t* lfsr) {
    switch (wave) {
        case WAVE_SQUARE_A:   /* 듀티 50% */
            return (phase * 2 < period) ? amp : -amp;
        case WAVE_SQUARE_B:   /* 듀티 25% (다른 음색) */
            return (phase * 4 < period) ? amp : -amp;
        case WAVE_TRIANGLE: {
            int half = period / 2;
            int t = (phase < half) ? phase : (period - phase);   /* 0..half */
            return (half > 0) ? (t * 2 * amp / half - amp) : 0;
        }
        case WAVE_NOISE: {
            /* 15bit LFSR. 매 표본 갱신. */
            uint32_t x = *lfsr;
            x = (x >> 1) | (((x ^ (x >> 1)) & 1u) << 14);
            *lfsr = x;
            return (x & 1u) ? amp : -amp;
        }
        default: return 0;
    }
}

int synth_render(const Song* song, int16_t* out, int max_samples, int sr) {
    int unit = sr / LENGTH_UNIT_DIV;

    /* 총 길이 = 트랙별 (음표 길이 합 × unit) 의 최대. */
    int total = 0;
    for (int t = 0; t < song->track_count; t++) {
        int s = 0;
        for (int i = 0; i < song->tracks[t].count; i++)
            s += song->tracks[t].notes[i].length;
        s *= unit;
        if (s > total) total = s;
    }
    if (total > max_samples) total = max_samples;
    for (int i = 0; i < total; i++) out[i] = 0;

    for (int t = 0; t < song->track_count; t++) {
        const Track* tr = &song->tracks[t];
        int pos = 0;
        uint32_t lfsr = 0xACE1u + (uint32_t)t;
        for (int i = 0; i < tr->count; i++) {
            const Note* nt = &tr->notes[i];
            int dur = nt->length * unit;
            int amp = nt->volume * AMP_PER_VOL;
            int period = (nt->pitch != 0) ? period_for(nt->pitch, sr) : 0;
            for (int k = 0; k < dur; k++) {
                int p = pos + k;
                if (p >= total) break;
                if (period > 0 && amp > 0) {
                    int phase = k % period;
                    int v = wave_sample(tr->wave, phase, period, amp, &lfsr);
                    out[p] = sat_add(out[p], v);
                }
            }
            pos += dur;
        }
    }
    return total;
}

/* ---- 테스트용 짧은 곡: 간단한 화음 + 베이스 + 드럼 ---- */
static const Note s_lead[] = {
    {72, 2, 12}, {76, 2, 12}, {79, 2, 12}, {76, 2, 12},
    {74, 2, 12}, {77, 2, 12}, {81, 2, 12}, {0, 2, 0}
};
static const Note s_harm[] = {
    {60, 4, 8}, {64, 4, 8}, {62, 4, 8}, {65, 4, 8}
};
static const Note s_bass[] = {
    {48, 4, 14}, {48, 4, 14}, {50, 4, 14}, {53, 4, 14}
};
static const Note s_drum[] = {
    {40, 1, 10}, {0, 1, 0}, {40, 1, 10}, {0, 1, 0},
    {40, 1, 10}, {0, 1, 0}, {40, 1, 10}, {0, 1, 0},
    {40, 1, 10}, {0, 1, 0}, {40, 1, 10}, {0, 1, 0},
    {40, 1, 10}, {0, 1, 0}, {40, 1, 10}, {0, 1, 0}
};
static const Track s_tracks[] = {
    { s_lead, (int)(sizeof(s_lead) / sizeof(Note)), WAVE_SQUARE_A },
    { s_harm, (int)(sizeof(s_harm) / sizeof(Note)), WAVE_SQUARE_B },
    { s_bass, (int)(sizeof(s_bass) / sizeof(Note)), WAVE_TRIANGLE },
    { s_drum, (int)(sizeof(s_drum) / sizeof(Note)), WAVE_NOISE }
};
const Song g_song_test = { s_tracks, 4 };

int song_test_byte_size(void) {
    return (int)(sizeof(s_lead) + sizeof(s_harm) + sizeof(s_bass) + sizeof(s_drum)
                 + sizeof(s_tracks) + sizeof(Song));
}
