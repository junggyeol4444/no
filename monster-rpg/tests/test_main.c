/* test_main.c — 테스트 러너 (SPEC T0-8). 100줄 이내, 외부 프레임워크 없음. */
#include "test.h"
#include "loader.h"
#include <string.h>

int g_tests_run = 0;
int g_tests_failed = 0;

int main(int argc, char** argv) {
    const char* data_dir = (argc > 1) ? argv[1] : "assets/build";
    int rc = data_load_all(data_dir);
    if (rc != 0) {
        printf("데이터 로드 실패 (%s): rc=%d\n", data_dir, rc);
        printf("먼저 `python3 tools/packdata.py assets/src assets/build` 실행 필요\n");
        return 2;
    }

    printf("[test_rng]\n");    test_rng();
    printf("[test_schema]\n"); test_schema();
    printf("[test_stats]\n");  test_stats();
    printf("[test_typechart]\n"); test_typechart();
    printf("[test_damage]\n"); test_damage();
    printf("[test_awaken]\n"); test_awaken();
    printf("[test_audio]\n");  test_audio();

    printf("\n%d개 검사 실행, %d개 실패\n", g_tests_run, g_tests_failed);
    return g_tests_failed ? 1 : 0;
}
