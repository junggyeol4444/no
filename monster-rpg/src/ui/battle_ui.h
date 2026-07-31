/* battle_ui.h — 전투 화면 텍스트 포맷터 (SPEC T1-9, P1은 텍스트 수준).
 * 순수 문자열 생성만 한다. raylib/platform 무의존 → 어디서나 링크된다.
 * raylib 화면은 이 문자열을 platform 텍스트 그리기로 출력하고,
 * 터미널 플레이(sim --play)는 그대로 printf 한다. */
#ifndef MRPG_UI_BATTLE_UI_H
#define MRPG_UI_BATTLE_UI_H

#include "../core/battle.h"

/* HP 막대 문자열. 25% 되돌이 임계선(SPEC 25-5)을 '|' 로 표시.
 * 예: "[#######|.....] 27/112" */
void ui_hp_bar(char* out, size_t n, int cur, int max, int width);

/* 양측 상태(이름·레벨·HP·되돌이·6능력치)를 여러 줄로 채운다. */
void ui_render_state(char* out, size_t n, const BattleState* st);

/* 한 개체의 스킬 4개 선택 메뉴. 사용 불가 스킬은 회색 표기 + 조건 병기. */
void ui_render_menu(char* out, size_t n, const BattleMon* m, int cursor);

#endif /* MRPG_UI_BATTLE_UI_H */
