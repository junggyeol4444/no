#!/bin/bash
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  WebNovel Studio 시작"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js 가 설치되어 있지 않습니다."
  echo "    - 방금 열리는 페이지에서 'LTS' 버전을 내려받아 설치하세요."
  echo "    - 설치가 끝나면 이 파일을 다시 더블클릭하면 됩니다."
  open "https://nodejs.org/ko" 2>/dev/null
  echo
  read -n 1 -s -r -p "엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[1/2] 처음 실행이라 필요한 구성요소를 설치합니다. 몇 분 걸릴 수 있어요..."
  echo
  npm install || {
    echo
    echo "[!] 설치에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 실행해 주세요."
    read -n 1 -s -r -p "엔터를 누르면 창이 닫힙니다..."
    exit 1
  }
fi

echo
echo "[2/2] 프로그램을 시작합니다. 잠시 후 브라우저가 자동으로 열립니다."
echo "      (종료하려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.)"
echo
( sleep 7; open "http://localhost:3000" 2>/dev/null ) &
npm run dev
