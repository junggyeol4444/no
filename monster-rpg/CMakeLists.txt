cmake_minimum_required(VERSION 3.20)
project(monster_rpg C)

# SPEC 1-1: 언어 C99, 외부 의존성은 raylib 하나만.
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

option(BUILD_GAME "raylib 게임 실행파일 빌드 (네트워크로 raylib fetch)" ON)

# ---------------------------------------------------------------------------
# 에셋 파이프라인 (T0-5): 빌드 전 packdata 자동 실행.
# ---------------------------------------------------------------------------
find_package(Python3 COMPONENTS Interpreter REQUIRED)
set(ASSET_SRC  ${CMAKE_SOURCE_DIR}/assets/src)
set(ASSET_OUT  ${CMAKE_SOURCE_DIR}/assets/build)
set(ASSET_BINS
    ${ASSET_OUT}/species.bin ${ASSET_OUT}/moves.bin
    ${ASSET_OUT}/typechart.bin ${ASSET_OUT}/strings.bin)

add_custom_command(
    OUTPUT ${ASSET_BINS}
    COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/tools/packdata.py
            ${ASSET_SRC} ${ASSET_OUT}
    DEPENDS ${ASSET_SRC}/species.json ${ASSET_SRC}/moves.json
            ${ASSET_SRC}/typechart.json ${CMAKE_SOURCE_DIR}/tools/packdata.py
    COMMENT "packdata: JSON -> 바이너리")
add_custom_target(assets DEPENDS ${ASSET_BINS})

# ---------------------------------------------------------------------------
# core 정적 라이브러리 — raylib 무의존 (철칙 1). core/data/audio/ui.
# ---------------------------------------------------------------------------
add_library(mrpg_core STATIC
    src/core/rng.c src/core/monster.c src/core/species.c src/core/moves.c
    src/core/typechart.c src/core/battle.c src/core/battle_log.c
    src/data/loader.c src/audio/synth.c src/ui/battle_ui.c)
target_include_directories(mrpg_core PUBLIC
    src src/core src/data src/audio src/ui src/platform)
add_dependencies(mrpg_core assets)

# ---------------------------------------------------------------------------
# 헤드리스 시뮬레이터 (T1-10, T1-11) — 되돌이 튜닝 하네스.
# ---------------------------------------------------------------------------
add_executable(sim src/sim_main.c)
target_link_libraries(sim PRIVATE mrpg_core)

# ---------------------------------------------------------------------------
# 테스트 (T0-8) — 외부 프레임워크 없음. platform_null 없이 core 만 링크.
# ---------------------------------------------------------------------------
enable_testing()
add_executable(run_tests
    tests/test_main.c tests/test_rng.c tests/test_schema.c tests/test_stats.c
    tests/test_typechart.c tests/test_damage.c tests/test_awaken.c tests/test_audio.c)
target_link_libraries(run_tests PRIVATE mrpg_core)

add_test(NAME unit
    COMMAND run_tests ${ASSET_OUT}
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})

# 골든 테스트 3건 (SPEC 9-2)
foreach(n 001 002 003)
    add_test(NAME golden_${n}
        COMMAND ${CMAKE_COMMAND}
            -DSIM=$<TARGET_FILE:sim>
            -DIN=${CMAKE_SOURCE_DIR}/tests/golden/case_${n}.in
            -DEXP=${CMAKE_SOURCE_DIR}/tests/golden/case_${n}.out
            -DDATA=${ASSET_OUT}
            -P ${CMAKE_SOURCE_DIR}/tests/run_golden.cmake)
endforeach()

# ---------------------------------------------------------------------------
# 게임 실행파일 (T0-1) — raylib 백엔드. FetchContent 로 raylib 을 가져온다.
# ---------------------------------------------------------------------------
if(BUILD_GAME)
    include(FetchContent)
    FetchContent_Declare(raylib
        GIT_REPOSITORY https://github.com/raysan5/raylib.git
        GIT_TAG 5.5)
    set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(raylib)

    add_executable(game src/main.c src/platform/platform_raylib.c)
    target_link_libraries(game PRIVATE mrpg_core raylib)

    # 빌드 후 용량 측정 (T0-7)
    add_custom_command(TARGET game POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/tools/measure.py
                --exe $<TARGET_FILE:game> --assets ${ASSET_OUT}
                --csv ${CMAKE_SOURCE_DIR}/build_size.csv --label "cmake-game"
        COMMENT "measure: 빌드 용량 기록")
endif()
