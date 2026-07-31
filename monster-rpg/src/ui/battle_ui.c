/* battle_ui.c — 전투 화면 텍스트 포맷터 (SPEC T1-9) */
#include "battle_ui.h"
#include "../core/species.h"
#include "../core/moves.h"
#include "../data/loader.h"
#include <stdio.h>
#include <string.h>

/* 타입 짧은 이름 (SPEC 5-6 인덱스 순서). */
static const char* TYPE_NAME[TYPE_COUNT] = {
    "화", "수", "목", "토", "금", "뇌", "광", "암"
};

static const char* type_name(int t) {
    if (t < 0 || t >= TYPE_COUNT) return "?";
    return TYPE_NAME[t];
}

static const char* species_name(uint16_t id) {
    const Species* sp = species_get(id);
    return sp ? string_get(sp->name_index) : "?";
}

void ui_hp_bar(char* out, size_t n, int cur, int max, int width) {
    if (width < 4) width = 4;
    if ((size_t)width + 32 > n) width = (int)n - 32;
    if (width < 4) { snprintf(out, n, "%d/%d", cur, max); return; }
    /* 채움 칸 수와 25% 임계 위치 계산 (정수). */
    int filled = (max > 0) ? cur * width / max : 0;
    if (filled < 0) filled = 0;
    if (filled > width) filled = width;
    int mark = width / 4;   /* 25% 위치 */

    char bar[128];
    int w = (width < 120) ? width : 120;
    for (int i = 0; i < w; i++) {
        if (i == mark)          bar[i] = (i < filled) ? '#' : '|';
        else                    bar[i] = (i < filled) ? '#' : '.';
    }
    bar[w] = '\0';
    snprintf(out, n, "[%s] %d/%d", bar, cur, max);
}

static void mon_type_str(char* buf, size_t n, const BattleMon* m) {
    if (m->type2 != TYPE_NONE)
        snprintf(buf, n, "%s/%s", type_name(m->type1), type_name(m->type2));
    else
        snprintf(buf, n, "%s", type_name(m->type1));
}

void ui_render_state(char* out, size_t n, const BattleState* st) {
    char b0[96], b1[96], t0[16], t1[16];
    ui_hp_bar(b0, sizeof(b0), st->mon[0].cur_hp, st->mon[0].max_hp, 24);
    ui_hp_bar(b1, sizeof(b1), st->mon[1].cur_hp, st->mon[1].max_hp, 24);
    mon_type_str(t0, sizeof(t0), &st->mon[0]);
    mon_type_str(t1, sizeof(t1), &st->mon[1]);

    const BattleMon* m0 = &st->mon[0];
    const BattleMon* m1 = &st->mon[1];
    snprintf(out, n,
        "P0 %s Lv%d [%s]%s\n"
        "   HP %s\n"
        "   공%d 방%d 특공%d 특방%d 속%d\n"
        "P1 %s Lv%d [%s]%s\n"
        "   HP %s\n"
        "   공%d 방%d 특공%d 특방%d 속%d\n",
        species_name(m0->species_id), m0->level, t0, m0->awakened ? " ★되돌이" : "",
        b0, m0->stat[STAT_ATK], m0->stat[STAT_DEF], m0->stat[STAT_SPA],
        m0->stat[STAT_SPD], m0->stat[STAT_SPE],
        species_name(m1->species_id), m1->level, t1, m1->awakened ? " ★되돌이" : "",
        b1, m1->stat[STAT_ATK], m1->stat[STAT_DEF], m1->stat[STAT_SPA],
        m1->stat[STAT_SPD], m1->stat[STAT_SPE]);
}

/* 유전자 조건을 사람이 읽을 문자열로. */
static void cond_text(char* buf, size_t n, uint8_t gene_cond) {
    static const char* STAT_KO[] = {"", "HP", "공격", "방어", "특공", "특방", "속도"};
    int stat = (gene_cond >> 4) & 0x07;
    if (stat == 0) { buf[0] = '\0'; return; }
    int rec = (gene_cond >> 7) & 0x01;
    int th = gene_cond & 0x0F;
    snprintf(buf, n, " (%s %s>=%d)", rec ? "열성" : "우성",
             (stat <= 6 ? STAT_KO[stat] : "?"), th);
}

void ui_render_menu(char* out, size_t n, const BattleMon* m, int cursor) {
    size_t off = 0;
    for (int i = 0; i < MOVES_PER_MON; i++) {
        const Move* mv = move_get(m->move_id[i]);
        const char* cur = (i == cursor) ? ">" : " ";
        if (!mv) {
            off += (size_t)snprintf(out + off, n - off, "%s [%d] ----\n", cur, i + 1);
            continue;
        }
        const char* name = string_get(mv->name_index);
        bool ok = battle_move_selectable(m, i);
        char ctext[48]; cond_text(ctext, sizeof(ctext), mv->gene_cond);
        off += (size_t)snprintf(out + off, n - off,
            "%s [%d] %-12s PP %2d/%-2d%s%s\n",
            cur, i + 1, name, m->move_pp[i], mv->pp,
            ok ? "" : "  (사용불가·회색)", ctext);
        if (off >= n) break;
    }
}
