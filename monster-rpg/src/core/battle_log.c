/* battle_log.c — 전투 로그 (SPEC 9-2) */
#include "battle_log.h"
#include <stdio.h>
#include <stdarg.h>

void log_init(BattleLog* log, bool enabled) {
    log->len = 0;
    log->buf[0] = '\0';
    log->enabled = enabled;
}

/* 버퍼 오버플로 없이 한 줄 추가. 넘치면 조용히 버린다(테스트에선 안 넘침). */
static void log_line(BattleLog* log, const char* fmt, ...) {
    if (!log || !log->enabled) return;
    if (log->len >= BATTLE_LOG_MAX - 1) return;
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(log->buf + log->len, BATTLE_LOG_MAX - log->len, fmt, ap);
    va_end(ap);
    if (n > 0) {
        log->len += (size_t)n;
        if (log->len >= BATTLE_LOG_MAX) log->len = BATTLE_LOG_MAX - 1;
    }
}

void log_turn(BattleLog* log, int turn) {
    log_line(log, "TURN %d\n", turn);
}
void log_act(BattleLog* log, int side, int move_id) {
    log_line(log, "ACT %d MOVE %d\n", side, move_id);
}
void log_hit(BattleLog* log, int side, int dmg, int eff, int crit, int stab) {
    log_line(log, "HIT %d DMG %d EFF %d CRIT %d STAB %d\n",
             side, dmg, eff, crit, stab);
}
void log_miss(BattleLog* log, int side) {
    log_line(log, "MISS %d\n", side);
}
void log_status(BattleLog* log, int side, int status_type, int dmg) {
    log_line(log, "STATUS %d %d DMG %d\n", side, status_type, dmg);
}
void log_awaken(BattleLog* log, int side, int old_max, int new_max,
                int old_cur, int new_cur) {
    log_line(log, "AWAKEN %d MAXHP %d -> %d CURHP %d -> %d\n",
             side, old_max, new_max, old_cur, new_cur);
}
void log_faint(BattleLog* log, int side) {
    log_line(log, "FAINT %d\n", side);
}
void log_end(BattleLog* log, int winner) {
    log_line(log, "END WINNER %d\n", winner);
}
