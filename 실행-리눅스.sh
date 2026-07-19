#!/bin/bash
cd "$(dirname "$0")" || exit 1

echo "WebNovel Studio 시작"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js 가 필요합니다. https://nodejs.org/ko 에서 LTS 를 설치한 뒤 다시 실행하세요."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[1/2] 처음 실행 설치 중... (몇 분 소요)"
  npm install || { echo "[!] 설치 실패. 인터넷 확인 후 재시도."; exit 1; }
fi

echo "[2/2] 시작합니다. 브라우저에서 http://localhost:3000 을 여세요. (종료: Ctrl+C)"
( sleep 7; xdg-open "http://localhost:3000" >/dev/null 2>&1 ) &
npm run dev
