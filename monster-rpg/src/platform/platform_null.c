/* platform_null.c — 헤드리스 더미 백엔드 (SPEC T0-2).
 * 전부 빈 함수. platform_null 로 링크해도 빌드된다(완료조건).
 * 테스트/자동 대전은 화면·입력·소리가 필요 없다. */
#include "platform.h"

bool plat_init(int width, int height, const char* title) {
    (void)width; (void)height; (void)title; return true;
}
void plat_shutdown(void) {}
bool plat_should_close(void) { return true; }   /* 즉시 종료 */

void plat_begin_frame(void) {}
void plat_end_frame(void) {}

bool plat_btn_down(PButton b) { (void)b; return false; }
bool plat_btn_pressed(PButton b) { (void)b; return false; }

void plat_fill_rect(PRect r, PColor c) { (void)r; (void)c; }
void plat_draw_text(const char* s, int x, int y, int size, PColor c) {
    (void)s; (void)x; (void)y; (void)size; (void)c;
}
PTexture plat_load_texture(const char* path) { (void)path; return -1; }
void plat_draw_sprite(PTexture t, PRect src, int dx, int dy) {
    (void)t; (void)src; (void)dx; (void)dy;
}

void plat_audio_submit(const int16_t* samples, int count) {
    (void)samples; (void)count;
}

long plat_file_read(const char* path, uint8_t* buf, long cap) {
    (void)path; (void)buf; (void)cap; return -1;
}
bool plat_file_write(const char* path, const uint8_t* buf, long len) {
    (void)path; (void)buf; (void)len; return false;
}
