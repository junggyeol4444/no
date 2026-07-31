/* schema.h — 바이너리 레이아웃 정의 (SPEC 2, 5장)
 * 에셋 파이프라인(tools/packdata.py) 산출물과 로더가 공유하는 규약. */
#ifndef MRPG_DATA_SCHEMA_H
#define MRPG_DATA_SCHEMA_H

#include "../core/config.h"

/* 파일 포맷 (전부 리틀 엔디언)
 *
 * species.bin
 *   u16 count
 *   count × 20바이트 레코드 (SPEC 5-3). 레코드 i → species_id (i+1).
 *
 * moves.bin
 *   u16 count
 *   count × 9바이트 레코드 (SPEC 5-4). 레코드 i → move_id (i+1).
 *
 * typechart.bin
 *   16바이트 (SPEC 5-6).
 *
 * strings.bin  (이름 문자열 풀)
 *   u16 count
 *   count × ( u16 length + length 바이트 UTF-8, 널 종료 없음 )
 *   문자열 index 는 0-기반. index 0 = 없음 규약용 빈 문자열.
 */

#define DATA_FILE_SPECIES   "species.bin"
#define DATA_FILE_MOVES     "moves.bin"
#define DATA_FILE_TYPECHART "typechart.bin"
#define DATA_FILE_STRINGS   "strings.bin"

#endif /* MRPG_DATA_SCHEMA_H */
