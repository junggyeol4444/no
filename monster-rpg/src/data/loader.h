/* loader.h — 바이너리 로더 (SPEC T0-4). 실패는 반환값으로 알린다 (SPEC 11장). */
#ifndef MRPG_DATA_LOADER_H
#define MRPG_DATA_LOADER_H

#include "../core/types.h"
#include "../core/config.h"

#define MAX_STRINGS 512

typedef struct {
    char     pool[STRING_POOL_MAX];
    size_t   pool_len;
    uint32_t offset[MAX_STRINGS];   /* pool 내 시작 오프셋 */
    uint16_t length[MAX_STRINGS];
    int      count;
} StringTable;

extern StringTable g_strings;

const char* string_get(uint16_t index);   /* 범위 밖이면 "" */

/* dir 아래에서 species/moves/typechart/strings 바이너리를 모두 읽는다.
 * 반환 0 = 성공, 음수 = 실패(파일별). */
int data_load_all(const char* dir);

int load_species(const char* path);
int load_moves(const char* path);
int load_typechart(const char* path);
int load_strings(const char* path);

#endif /* MRPG_DATA_LOADER_H */
