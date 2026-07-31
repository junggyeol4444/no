/* sim_main.c — 헤드리스 되돌이 튜닝 하네스 + 골든 러너 (SPEC T1-10, T1-11).
 *
 * 이 실행파일이 P1 의 실제 목적이다: 임계값·타이밍을 바꿔가며
 * "되돌이가 재미있는 지점"을 찾기 위한 도구 (SPEC 8장 T1-11, 13장).
 *
 * raylib 무의존. core/ + data/ 만 링크한다.
 *
 * 사용:
 *   sim --auto N [--seed S] [--awaken-threshold P] [--awaken-timing endturn|immediate]
 *   sim --golden <case.in>        # 스크립트 전투를 돌려 로그를 stdout 에 출력
 *   sim --data <dir>              # 데이터 디렉토리 (기본 assets/build)
 */
#include "core/config.h"
#include "core/rng.h"
#include "core/monster.h"
#include "core/species.h"
#include "core/moves.h"
#include "core/typechart.h"
#include "core/battle.h"
#include "core/battle_log.h"
#include "ui/battle_ui.h"
#include "data/loader.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AUTO_LEVEL 50
#define AUTO_SPECIES_COUNT 3

/* ----- 자동 대전 통계 (SPEC 13-1) ----- */
typedef struct {
    long battles;
    long sum_turns;
    long sum_turns2;      /* 분산용 */
    long awaken_battles;  /* 한 측이라도 되돌이한 전투 수 */
    long reversal_wins;   /* 승자가 되돌이했던 전투 수 (되돌이 후 역전) */
    long draws;
} AutoStats;

static void run_one_auto(Rng* enc, AwakenConfig cfg, uint64_t battle_seed,
                         AutoStats* st) {
    /* 개체 2마리 생성 (조우 스트림에서). 종은 순환/무작위, 레벨 고정. */
    uint16_t sp0 = (uint16_t)(1 + rng_range(enc, AUTO_SPECIES_COUNT));
    Monster m0 = wild_generate(enc, sp0, AUTO_LEVEL);
    uint16_t sp1 = (uint16_t)(1 + rng_range(enc, AUTO_SPECIES_COUNT));
    Monster m1 = wild_generate(enc, sp1, AUTO_LEVEL);

    BattleState bs;
    battle_init(&bs, &m0, &m1, cfg);

    Rng rb;
    rng_seed(&rb, battle_seed, RNG_BATTLE);

    BattleLog log; log_init(&log, false);   /* 자동 대전은 로그 비활성(성능) */
    while (!bs.over) {
        Action a0 = ai_choose(&bs, 0);
        Action a1 = ai_choose(&bs, 1);
        battle_step(&bs, a0, a1, &rb, &log);
    }

    st->battles++;
    st->sum_turns += bs.turn;
    st->sum_turns2 += (long)bs.turn * bs.turn;
    bool any_awaken = bs.awakened_ever[0] || bs.awakened_ever[1];
    if (any_awaken) st->awaken_battles++;
    if (bs.winner < 0) st->draws++;
    else if (bs.awakened_ever[bs.winner]) st->reversal_wins++;
}

static int run_auto(Rng* enc, AwakenConfig cfg, uint64_t seed, long n) {
    AutoStats st; memset(&st, 0, sizeof(st));
    for (long i = 0; i < n; i++) {
        /* 전투별 독립 시드: seed 와 인덱스를 섞는다 (스트림 분리, SPEC 4-2). */
        uint64_t bseed = seed * 0x9E3779B97F4A7C15ULL + (uint64_t)i;
        run_one_auto(enc, cfg, bseed, &st);
    }

    long n1 = st.battles ? st.battles : 1;
    /* 정수 고정소수점 출력 (부동소수점 미사용). */
    long avg_turns_x100 = st.sum_turns * 100 / n1;
    long var_x100 = (st.battles * st.sum_turns2 - st.sum_turns * st.sum_turns)
                    * 100 / (n1 * n1);
    long awaken_permille = st.awaken_battles * 1000 / n1;
    long rev_den = st.awaken_battles ? st.awaken_battles : 1;
    long reversal_permille = st.reversal_wins * 1000 / rev_den;

    printf("=== 되돌이 자동 대전 통계 ===\n");
    printf("임계값        : %d/%d (%ld%%)\n", cfg.threshold_num, cfg.threshold_den,
           (long)cfg.threshold_num * 100 / cfg.threshold_den);
    printf("발동 타이밍   : %s\n", cfg.immediate ? "immediate" : "endturn");
    printf("전투 수       : %ld (무승부 %ld)\n", st.battles, st.draws);
    printf("평균 턴 수    : %ld.%02ld\n", avg_turns_x100 / 100, avg_turns_x100 % 100);
    printf("전투 길이 분산: %ld.%02ld\n", var_x100 / 100,
           (var_x100 % 100 + 100) % 100);
    printf("되돌이 발동률 : %ld.%ld%% (%ld / %ld 전투)\n",
           awaken_permille / 10, awaken_permille % 10, st.awaken_battles, st.battles);
    printf("되돌이 역전율 : %ld.%ld%% (승자가 되돌이한 비율, 되돌이 발생 전투 기준)\n",
           reversal_permille / 10, reversal_permille % 10);
    return 0;
}

/* ----- 골든 러너 (SPEC T1-10, 9-2) ----- */

/* .in 포맷 (텍스트, # 주석):
 *   SEED <n>
 *   THRESHOLD <percent>              (선택)
 *   TIMING <endturn|immediate>       (선택)
 *   MON <side> <species> <level> <g0..g5 hex> <nature> <ability>
 *   IN <slot0> <slot1>               (선택, 턴별. 없으면 AI 사용)
 */
typedef struct {
    int  side, slot0, slot1;
} InputLine;

static int run_golden(const char* path, const char* data_dir) {
    (void)data_dir;
    FILE* f = fopen(path, "r");
    if (!f) { fprintf(stderr, "골든 파일 열기 실패: %s\n", path); return 2; }

    uint64_t seed = 0;
    AwakenConfig cfg = awaken_config_default();
    Monster mon[2];
    int mon_set[2] = {0, 0};
    memset(mon, 0, sizeof(mon));
    InputLine inputs[MAX_BATTLE_TURNS];
    int n_inputs = 0;

    char line[256];
    while (fgets(line, sizeof(line), f)) {
        if (line[0] == '#' || line[0] == '\n') continue;
        char kw[32];
        if (sscanf(line, "%31s", kw) != 1) continue;

        if (strcmp(kw, "SEED") == 0) {
            sscanf(line, "%*s %llu", (unsigned long long*)&seed);
        } else if (strcmp(kw, "THRESHOLD") == 0) {
            int p; sscanf(line, "%*s %d", &p);
            cfg.threshold_num = p; cfg.threshold_den = 100;
        } else if (strcmp(kw, "TIMING") == 0) {
            char t[16]; sscanf(line, "%*s %15s", t);
            cfg.immediate = (strcmp(t, "immediate") == 0);
        } else if (strcmp(kw, "MON") == 0) {
            int side, sp, lv, g[6], nat, ab;
            int got = sscanf(line, "%*s %d %d %d %x %x %x %x %x %x %d %d",
                             &side, &sp, &lv, &g[0], &g[1], &g[2], &g[3],
                             &g[4], &g[5], &nat, &ab);
            if (got == 11 && (side == 0 || side == 1)) {
                uint8_t genes[6];
                for (int i = 0; i < 6; i++) genes[i] = (uint8_t)g[i];
                mon[side] = debug_make((uint16_t)sp, (uint8_t)lv, genes, (uint8_t)nat);
                mon[side].ability = (uint8_t)ab;
                mon_set[side] = 1;
            }
        } else if (strcmp(kw, "IN") == 0) {
            if (n_inputs < MAX_BATTLE_TURNS) {
                int s0, s1;
                if (sscanf(line, "%*s %d %d", &s0, &s1) == 2) {
                    inputs[n_inputs].slot0 = s0;
                    inputs[n_inputs].slot1 = s1;
                    n_inputs++;
                }
            }
        }
    }
    fclose(f);

    if (!mon_set[0] || !mon_set[1]) {
        fprintf(stderr, "골든 파일에 양측 MON 이 필요하다: %s\n", path);
        return 3;
    }

    BattleState bs;
    battle_init(&bs, &mon[0], &mon[1], cfg);
    Rng rb; rng_seed(&rb, seed, RNG_BATTLE);

    static BattleLog log;   /* 정적: 큰 버퍼를 스택에 두지 않는다 */
    log_init(&log, true);

    int turn_idx = 0;
    while (!bs.over) {
        Action a0, a1;
        if (turn_idx < n_inputs) {
            a0.move_slot = inputs[turn_idx].slot0;
            a1.move_slot = inputs[turn_idx].slot1;
        } else {
            a0 = ai_choose(&bs, 0);
            a1 = ai_choose(&bs, 1);
        }
        battle_step(&bs, a0, a1, &rb, &log);
        turn_idx++;
    }

    fputs(log.buf, stdout);
    return 0;
}

/* ----- 터미널 대화형 플레이 (SPEC T1-9: 사람이 한 판 끝까지 플레이) ----- */
static int run_play(uint64_t seed, AwakenConfig cfg) {
    /* 플레이어=P0(불꽃도마뱀), 상대=P1(새싹짐승). 야생 생성 개체. */
    Rng enc; rng_seed(&enc, seed, RNG_ENCOUNTER);
    Monster m0 = wild_generate(&enc, 1, AUTO_LEVEL);
    Monster m1 = wild_generate(&enc, 3, AUTO_LEVEL);

    BattleState bs;
    battle_init(&bs, &m0, &m1, cfg);
    Rng rb; rng_seed(&rb, seed, RNG_BATTLE);

    char state[512], menu[512], line[64];
    printf("=== 되돌이 전투 프로토타입 (P1) ===\n");
    printf("숫자 1~4 로 스킬 선택, q 로 포기.\n\n");

    while (!bs.over) {
        ui_render_state(state, sizeof(state), &bs);
        ui_render_menu(menu, sizeof(menu), &bs.mon[0], -1);
        printf("--- 턴 %d ---\n%s\n당신의 스킬:\n%s선택> ", bs.turn + 1, state, menu);
        fflush(stdout);

        if (!fgets(line, sizeof(line), stdin)) break;
        if (line[0] == 'q') { printf("포기했다.\n"); return 0; }
        int slot = line[0] - '1';
        if (slot < 0 || slot >= MOVES_PER_MON || !battle_move_selectable(&bs.mon[0], slot)) {
            printf("사용할 수 없는 스킬이다.\n\n");
            continue;
        }

        Action a0 = { slot };
        Action a1 = ai_choose(&bs, 1);
        static BattleLog log; log_init(&log, true);
        battle_step(&bs, a0, a1, &rb, &log);
        printf("%s\n", log.buf);
    }

    ui_render_state(state, sizeof(state), &bs);
    printf("%s", state);
    if (bs.winner == 0)      printf("== 당신의 승리! ==\n");
    else if (bs.winner == 1) printf("== 패배… ==\n");
    else                     printf("== 무승부 ==\n");
    return 0;
}

int main(int argc, char** argv) {
    const char* data_dir = "assets/build";
    const char* golden = NULL;
    long auto_n = 0;
    bool play = false;
    uint64_t seed = 1;
    AwakenConfig cfg = awaken_config_default();

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--auto") == 0 && i + 1 < argc) {
            auto_n = atol(argv[++i]);
        } else if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
            seed = strtoull(argv[++i], NULL, 10);
        } else if (strcmp(argv[i], "--awaken-threshold") == 0 && i + 1 < argc) {
            int p = atoi(argv[++i]);
            cfg.threshold_num = p; cfg.threshold_den = 100;
        } else if (strcmp(argv[i], "--awaken-timing") == 0 && i + 1 < argc) {
            cfg.immediate = (strcmp(argv[++i], "immediate") == 0);
        } else if (strcmp(argv[i], "--golden") == 0 && i + 1 < argc) {
            golden = argv[++i];
        } else if (strcmp(argv[i], "--play") == 0) {
            play = true;
        } else if (strcmp(argv[i], "--data") == 0 && i + 1 < argc) {
            data_dir = argv[++i];
        } else {
            fprintf(stderr, "알 수 없는 인자: %s\n", argv[i]);
            return 1;
        }
    }

    int rc = data_load_all(data_dir);
    if (rc != 0) {
        fprintf(stderr, "데이터 로드 실패 (%s): rc=%d\n", data_dir, rc);
        return 2;
    }

    if (golden) return run_golden(golden, data_dir);
    if (play) return run_play(seed, cfg);

    if (auto_n > 0) {
        Rng enc; rng_seed(&enc, seed, RNG_ENCOUNTER);
        return run_auto(&enc, cfg, seed, auto_n);
    }

    fprintf(stderr, "사용: sim --auto N [--seed S] [--awaken-threshold P]"
                    " [--awaken-timing endturn|immediate]\n"
                    "      sim --golden <case.in>\n");
    return 1;
}
