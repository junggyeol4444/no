/* platform.h — 플랫폼 추상 인터페이스 (SPEC T0-2, 철칙 1).
 * core/ 는 이 헤더만 호출한다. raylib 은 platform_raylib.c 안에만 존재한다.
 * 콘솔 이식 시 platform_*.c 하나만 새로 쓰면 된다. */
#ifndef MRPG_PLATFORM_H
#define MRPG_PLATFORM_H

#include <stdint.h>
#include <stdbool.h>

typedef struct { int x, y, w, h; } PRect;
typedef struct { uint8_t r, g, b, a; } PColor;
typedef int PTexture;   /* 텍스처 핸들. -1 = 무효 */

/* 논리 입력 (SPEC 25-2). 물리 키/패드 매핑은 백엔드가 담당. */
typedef enum {
    PBTN_UP, PBTN_DOWN, PBTN_LEFT, PBTN_RIGHT,
    PBTN_CONFIRM, PBTN_CANCEL, PBTN_MENU, PBTN_AUX1, PBTN_AUX2,
    PBTN_COUNT
} PButton;

/* 초기화·종료 */
bool plat_init(int width, int height, const char* title);
void plat_shutdown(void);
bool plat_should_close(void);

/* 프레임 시작·종료 */
void plat_begin_frame(void);
void plat_end_frame(void);

/* 논리 입력 상태 조회 */
bool plat_btn_down(PButton b);     /* 눌린 상태 유지 */
bool plat_btn_pressed(PButton b);  /* 이번 프레임에 눌림(엣지) */

/* 그리기 */
void plat_fill_rect(PRect r, PColor c);
void plat_draw_text(const char* s, int x, int y, int size, PColor c);
PTexture plat_load_texture(const char* path);
void plat_draw_sprite(PTexture t, PRect src, int dx, int dy);

/* 오디오 출력 버퍼 제출 (모노 16bit PCM) */
void plat_audio_submit(const int16_t* samples, int count);

/* 파일 읽기·쓰기. 실패는 반환값으로 (SPEC 11장). */
long plat_file_read(const char* path, uint8_t* buf, long cap);   /* -1 실패 */
bool plat_file_write(const char* path, const uint8_t* buf, long len);

#endif /* MRPG_PLATFORM_H */
