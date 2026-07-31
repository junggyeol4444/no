# 몬스터 수집 RPG — P0 + P1 프로토타입

SPEC-1.0 명세 구현. 범위는 **P0(기술 기반) + P1(되돌이 전투 프로토타입)** 뿐이다.
브리딩·진화·필드·포획·스토리·168종·120스킬 등은 범위 밖이다(SPEC 0-2, 10장).

- 언어: **C99** / 외부 의존성: **raylib 5.x 하나만**
- 빌드: **CMake 3.20+** / 테스트: 자체 최소 하네스(외부 프레임워크 없음)
- 결정론: PCG32 + 정수 연산 → 같은 시드·입력이면 전투 로그가 바이트 단위로 동일

P1 의 목적은 게임을 만드는 게 아니라 **"되돌이가 재미있는가"** 라는 질문 하나에
답하기 위한 측정 도구를 만드는 것이다(SPEC 0-4, T1-11). 측정 결과는
[`P1_FINDINGS.md`](P1_FINDINGS.md) 참조.

## 디렉토리

```
src/core/      게임 로직 (raylib 무의존, 철칙 1)
src/data/      바이너리 스키마 + 로더
src/audio/     런타임 오디오 합성기 (T0-6)
src/ui/        전투 화면 텍스트 포맷터 (T1-9)
src/platform/  platform.h + raylib/null 백엔드 (T0-2)
src/main.c     게임 진입점 (raylib)
src/sim_main.c 헤드리스 시뮬레이터: 되돌이 튜닝 + 골든 러너 + 터미널 플레이
assets/src/    원본 JSON (종·스킬·상성표)
tools/         packdata.py / packsprite.py / measure.py
tests/         단위 테스트 + 골든 케이스
```

## 빌드 & 실행

### 1) 전체 빌드 (raylib 게임 포함, 데스크톱)

raylib 을 FetchContent 로 자동으로 가져온다(네트워크 필요).

```sh
cmake -S . -B build            # raylib 다운로드 + 구성
cmake --build build
./build/game                   # raylib 전투 화면 (ESC 종료)
```

> raylib 기본 폰트는 한글 글리프가 없다. 게임 창의 한글 UI 는 폰트 동봉이
> 필요하다(SPEC 26-5 미결). 로직 검증은 아래 헤드리스 경로로 한다.

### 2) 헤드리스 (raylib 없이 — 로직/테스트/튜닝)

raylib 없이 core/data 만 빌드·검증한다.

```sh
./run_tests.sh                 # 데이터 빌드 + 단위·골든·정적 검사 전부
```

또는 CMake 로 헤드리스 타깃만:

```sh
cmake -S . -B build -DBUILD_GAME=OFF
cmake --build build
cd build && ctest --output-on-failure
```

## 되돌이 튜닝 하네스 (T1-11 — P1 의 실제 목적)

```sh
# 자동 대전 1000판 통계 (평균 턴/발동률/역전율/분산)
./build/sim --auto 1000 --seed 12345 --awaken-threshold 25 --awaken-timing endturn

# 임계값 스윕 (15/20/25/30/40%)
for t in 15 20 25 30 40; do ./build/sim --auto 1000 --awaken-threshold $t; done
```

## 터미널에서 한 판 플레이 (T1-9)

raylib 없이 텍스트로 한 판 끝까지 플레이할 수 있다.

```sh
./build/sim --play --seed 5
# 숫자 1~4 로 스킬 선택. 되돌이 임계선(25%)이 HP 막대에 '|' 로 표시된다.
```

## 용량 하한 (SPEC P0 완료조건)

빈/최소 프로젝트 빌드 용량이 이 프로젝트의 하한이다. `build_size.csv` 에
빌드마다 항목별(실행파일/오디오/이미지/데이터)로 누적 기록된다.
헤드리스 최소 실행파일 기준 데이터는 316바이트(패킹된 종·스킬·상성표·문자열),
곡 데이터는 176바이트(≤2KB)다.

## 철칙 (위반 시 커밋 무효, SPEC 3장)

1. `src/core/` 는 raylib 을 모른다 — `platform.h` 만 호출
2. 게임 로직에 float/double 금지 — 전부 정수, 배율은 분자/분모 쌍
3. 모든 무작위는 명시적 시드에서 (`rand()`/`srand()` 금지)
4. 매직넘버 금지 — `config.h` 에 이름 정의
5. 명세 밖 기능 금지

`run_tests.sh` 가 이 정적 검사(9-3)를 CI 로 수행한다.
