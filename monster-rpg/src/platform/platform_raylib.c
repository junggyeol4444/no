/* platform_raylib.c — raylib 5.x 백엔드 (SPEC T0-2).
 * raylib 에 의존하는 유일한 파일이다 (철칙 1).
 * ※ 헤드리스 CI 에서는 빌드되지 않는다. raylib 이 있는 데스크톱에서 빌드된다. */
#include "platform.h"
#include "raylib.h"
#include <stdio.h>

#define MAX_TEXTURES 64
static Texture2D s_textures[MAX_TEXTURES];
static int s_texture_count = 0;

static AudioStream s_stream;
static bool s_audio_ready = false;

/* 논리 버튼 → 물리 키 매핑 (SPEC 25-2). 콘솔 백엔드는 이 표만 바꾸면 된다. */
static int s_key[PBTN_COUNT] = {
    [PBTN_UP] = KEY_UP, [PBTN_DOWN] = KEY_DOWN,
    [PBTN_LEFT] = KEY_LEFT, [PBTN_RIGHT] = KEY_RIGHT,
    [PBTN_CONFIRM] = KEY_Z, [PBTN_CANCEL] = KEY_X,
    [PBTN_MENU] = KEY_ENTER, [PBTN_AUX1] = KEY_A, [PBTN_AUX2] = KEY_S
};

bool plat_init(int width, int height, const char* title) {
    InitWindow(width, height, title);
    if (!IsWindowReady()) return false;
    SetTargetFPS(60);
    InitAudioDevice();
    if (IsAudioDeviceReady()) {
        /* 22050Hz, 16bit, 모노 스트림 (SPEC 26-6 런타임 합성 출력). */
        s_stream = LoadAudioStream(22050, 16, 1);
        PlayAudioStream(s_stream);
        s_audio_ready = true;
    }
    return true;
}

void plat_shutdown(void) {
    for (int i = 0; i < s_texture_count; i++) UnloadTexture(s_textures[i]);
    if (s_audio_ready) { UnloadAudioStream(s_stream); }
    if (IsAudioDeviceReady()) CloseAudioDevice();
    CloseWindow();
}

bool plat_should_close(void) { return WindowShouldClose(); }

void plat_begin_frame(void) { BeginDrawing(); ClearBackground((Color){20, 20, 28, 255}); }
void plat_end_frame(void)   { EndDrawing(); }

bool plat_btn_down(PButton b)    { return (b < PBTN_COUNT) && IsKeyDown(s_key[b]); }
bool plat_btn_pressed(PButton b) { return (b < PBTN_COUNT) && IsKeyPressed(s_key[b]); }

void plat_fill_rect(PRect r, PColor c) {
    DrawRectangle(r.x, r.y, r.w, r.h, (Color){c.r, c.g, c.b, c.a});
}
void plat_draw_text(const char* s, int x, int y, int size, PColor c) {
    DrawText(s, x, y, size, (Color){c.r, c.g, c.b, c.a});
}

PTexture plat_load_texture(const char* path) {
    if (s_texture_count >= MAX_TEXTURES) return -1;
    Texture2D t = LoadTexture(path);
    if (t.id == 0) return -1;
    s_textures[s_texture_count] = t;
    return s_texture_count++;
}
void plat_draw_sprite(PTexture t, PRect src, int dx, int dy) {
    if (t < 0 || t >= s_texture_count) return;
    Rectangle sr = {(float)src.x, (float)src.y, (float)src.w, (float)src.h};
    Rectangle dr = {(float)dx, (float)dy, (float)src.w, (float)src.h};
    DrawTexturePro(s_textures[t], sr, dr, (Vector2){0, 0}, 0.0f, WHITE);
}

void plat_audio_submit(const int16_t* samples, int count) {
    if (!s_audio_ready) return;
    if (IsAudioStreamProcessed(s_stream))
        UpdateAudioStream(s_stream, samples, count);
}

long plat_file_read(const char* path, uint8_t* buf, long cap) {
    FILE* f = fopen(path, "rb");
    if (!f) return -1;
    long n = (long)fread(buf, 1, (size_t)cap, f);
    fclose(f);
    return n;
}
bool plat_file_write(const char* path, const uint8_t* buf, long len) {
    FILE* f = fopen(path, "wb");
    if (!f) return false;
    fwrite(buf, 1, (size_t)len, f);
    fclose(f);
    return true;
}
