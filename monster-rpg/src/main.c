/* main.c — 진입점. 플랫폼 초기화 + 루프 (SPEC T0-1, T1-9).
 * platform.h 만 호출한다 (철칙 1). raylib.h 를 직접 include 하지 않는다.
 * 그래서 platform_raylib / platform_null 어느 쪽으로 링크해도 빌드된다. */
#include "platform/platform.h"
#include "core/config.h"
#include "core/rng.h"
#include "core/monster.h"
#include "core/battle.h"
#include "core/battle_log.h"
#include "ui/battle_ui.h"
#include "audio/synth.h"
#include "data/loader.h"
#include <string.h>
#include <stdio.h>

#define SCREEN_W 640
#define SCREEN_H 480
#define TEXT_SIZE 16
#define LINE_H 18
#define AUDIO_SR 22050
#define AUDIO_CHUNK 2048

static const PColor COL_TEXT = {230, 230, 235, 255};
static const PColor COL_DIM  = {120, 120, 130, 255};

/* 여러 줄 텍스트를 줄 단위로 그린다. */
static void draw_multiline(const char* text, int x, int y, PColor c) {
    char line[128];
    int li = 0, row = 0;
    for (const char* p = text; ; p++) {
        if (*p == '\n' || *p == '\0') {
            line[li] = '\0';
            plat_draw_text(line, x, y + row * LINE_H, TEXT_SIZE, c);
            li = 0; row++;
            if (*p == '\0') break;
        } else if (li < (int)sizeof(line) - 1) {
            line[li++] = *p;
        }
    }
}

int main(int argc, char** argv) {
    const char* data_dir = (argc > 1) ? argv[1] : "assets/build";

    if (!plat_init(SCREEN_W, SCREEN_H, "Monster RPG - P1 Return Prototype")) {
        fprintf(stderr, "플랫폼 초기화 실패\n");
        return 1;
    }
    if (data_load_all(data_dir) != 0) {
        fprintf(stderr, "데이터 로드 실패: %s\n", data_dir);
        plat_shutdown();
        return 2;
    }

    /* 데모 전투 구성 */
    Rng enc; rng_seed(&enc, 1, RNG_ENCOUNTER);
    Monster p0 = wild_generate(&enc, 1, 50);
    Monster p1 = wild_generate(&enc, 3, 50);
    BattleState bs;
    battle_init(&bs, &p0, &p1, awaken_config_default());
    Rng rb; rng_seed(&rb, 1, RNG_BATTLE);
    static BattleLog log; log_init(&log, true);

    /* 테스트 곡 렌더 (SPEC T0-6). 프레임마다 조금씩 스트림에 밀어넣는다. */
    static int16_t song[AUDIO_SR * 3];
    int song_len = synth_render(&g_song_test, song, AUDIO_SR * 3, AUDIO_SR);
    int song_pos = 0;

    int cursor = 0;
    char state[512], menu[512];

    while (!plat_should_close()) {
        /* --- 입력 --- */
        if (plat_btn_pressed(PBTN_UP))   cursor = (cursor + MOVES_PER_MON - 1) % MOVES_PER_MON;
        if (plat_btn_pressed(PBTN_DOWN)) cursor = (cursor + 1) % MOVES_PER_MON;
        if (plat_btn_pressed(PBTN_CONFIRM) && !bs.over) {
            if (battle_move_selectable(&bs.mon[0], cursor)) {
                Action a0 = { cursor };
                Action a1 = ai_choose(&bs, 1);
                battle_step(&bs, a0, a1, &rb, &log);
            }
        }

        /* --- 오디오 스트림 공급 --- */
        if (song_len > 0) {
            int remain = song_len - song_pos;
            int chunk = remain < AUDIO_CHUNK ? remain : AUDIO_CHUNK;
            if (chunk > 0) { plat_audio_submit(song + song_pos, chunk); song_pos += chunk; }
            else song_pos = 0;   /* 루프 */
        }

        /* --- 그리기 --- */
        plat_begin_frame();
        ui_render_state(state, sizeof(state), &bs);
        draw_multiline(state, 12, 12, COL_TEXT);

        if (!bs.over) {
            ui_render_menu(menu, sizeof(menu), &bs.mon[0], cursor);
            draw_multiline(menu, 12, 12 + 7 * LINE_H, COL_TEXT);
            plat_draw_text("UP/DOWN: select  Z: use  ESC: quit",
                           12, SCREEN_H - 24, TEXT_SIZE, COL_DIM);
        } else {
            const char* msg = (bs.winner == 0) ? "YOU WIN"
                            : (bs.winner == 1) ? "YOU LOSE" : "DRAW";
            plat_draw_text(msg, 12, 12 + 7 * LINE_H, TEXT_SIZE * 2, COL_TEXT);
        }
        plat_end_frame();
    }

    plat_shutdown();
    return 0;
}
