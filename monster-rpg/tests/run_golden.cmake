# run_golden.cmake — 골든 케이스 하나를 실행하고 기대 출력과 바이트 비교.
# ctest 에서 호출된다. 변수: SIM, IN, EXP, DATA.
execute_process(
    COMMAND ${SIM} --golden ${IN} --data ${DATA}
    OUTPUT_VARIABLE got
    RESULT_VARIABLE rc)
if(NOT rc EQUAL 0)
    message(FATAL_ERROR "sim 실행 실패 (rc=${rc}) for ${IN}")
endif()
file(READ ${EXP} expected)
if(NOT got STREQUAL expected)
    message(FATAL_ERROR "골든 불일치: ${IN}\n--- got ---\n${got}\n--- expected ---\n${expected}")
endif()
message(STATUS "golden OK: ${IN}")
