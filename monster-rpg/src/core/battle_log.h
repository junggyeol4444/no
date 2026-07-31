/* battle_log.h — 전투 로그 (SPEC 9-2). 테스트/재현/골든 비교용.
 * 고정 버퍼. 동적 할당은 초기화 시점에만 (SPEC 11장). */
#ifndef MRPG_CORE_BATTLE_LOG_H
#define MRPG_CORE_BATTLE_LOG_H

#include "types.h"
#include "config.h"

typedef struct {
    char   buf[BATTLE_LOG_MAX];
    size_t len;
    bool   enabled;   /* false 면 기록하지 않는다 (자동 대전 성능용) */
} BattleLog;

void log_init(BattleLog* log, bool enabled);

/* SPEC 9-2 고정 로그 형식 */
void log_turn(BattleLog* log, int turn);
void log_act(BattleLog* log, int side, int move_id);
void log_hit(BattleLog* log, int side, int dmg, int eff, int crit, int stab);
void log_miss(BattleLog* log, int side);
void log_status(BattleLog* log, int side, int status_type, int dmg);
void log_awaken(BattleLog* log, int side, int old_max, int new_max,
                int old_cur, int new_cur);
void log_faint(BattleLog* log, int side);
void log_end(BattleLog* log, int winner);   /* winner: 0/1, 무승부 -1 */

#endif /* MRPG_CORE_BATTLE_LOG_H */
