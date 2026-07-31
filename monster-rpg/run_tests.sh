#!/usr/bin/env bash
# run_tests.sh — raylib 없이 core/data 를 헤드리스로 빌드·테스트한다 (SPEC T0-8).
# CMake 없이도 검증 가능하게 한 얇은 스크립트. (전체 빌드는 CMakeLists.txt)
set -e
cd "$(dirname "$0")"

CC=${CC:-gcc}
CFLAGS="-std=c99 -O2 -Wall -Wextra -Wno-unused-parameter -Isrc -Isrc/core -Isrc/data"
OUT=build_test
mkdir -p "$OUT"

CORE="src/core/rng.c src/core/monster.c src/core/species.c src/core/moves.c \
      src/core/typechart.c src/core/battle.c src/core/battle_log.c src/data/loader.c"

echo "== 데이터 파이프라인 =="
python3 tools/packdata.py assets/src assets/build

echo "== 단위 테스트 빌드 =="
$CC $CFLAGS $CORE src/audio/synth.c -Isrc/audio \
    tests/test_main.c tests/test_rng.c tests/test_schema.c tests/test_stats.c \
    tests/test_typechart.c tests/test_damage.c tests/test_awaken.c tests/test_audio.c \
    -o "$OUT/run_tests"

echo "== 시뮬레이터 빌드 =="
$CC $CFLAGS $CORE src/ui/battle_ui.c src/sim_main.c -o "$OUT/sim"

echo "== 단위 테스트 실행 =="
"./$OUT/run_tests" assets/build

echo ""
echo "== 골든 테스트 (SPEC 9-2) =="
golden_fail=0
for n in 001 002 003; do
    inf="tests/golden/case_$n.in"
    exp="tests/golden/case_$n.out"
    got=$("./$OUT/sim" --golden "$inf" --data assets/build)
    if [ "$got" == "$(cat "$exp")" ]; then
        echo "  PASS golden $n"
    else
        echo "  FAIL golden $n"
        diff <(echo "$got") "$exp" | head -20 || true
        golden_fail=1
    fi
done

echo ""
echo "== 정적 검사 (SPEC 9-3) =="
static_fail=0
check_grep() {
    local desc="$1"; shift
    if grep -rnE "$@" >/dev/null 2>&1; then
        echo "  FAIL $desc"; grep -rnE "$@" | head -5; static_fail=1
    else
        echo "  PASS $desc"
    fi
}
check_grep "core/data 에 raylib.h 없음"           'raylib\.h' src/core/ src/data/
check_grep "core/data 에 float/double 없음"       '\<float\>|\<double\>' src/core/ src/data/
check_grep "core/data 에 rand/srand 없음"         '\<rand\(|\<srand\(' src/core/ src/data/
check_grep "core 에 malloc/free 없음"             'malloc|free' src/core/

if [ "$golden_fail" != "0" ] || [ "$static_fail" != "0" ]; then
    echo ""; echo "실패 있음"; exit 1
fi
echo ""; echo "전체 통과"
