@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WebNovel Studio

echo ============================================
echo   WebNovel Studio 시작
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js 가 설치되어 있지 않습니다.
  echo     - 방금 열리는 페이지에서 "LTS" 버전을 내려받아 설치하세요.
  echo     - 설치가 끝나면 이 파일을 다시 더블클릭하면 됩니다.
  start https://nodejs.org/ko
  echo.
  pause
  exit /b
)

if not exist "node_modules" (
  echo [1/2] 처음 실행이라 필요한 구성요소를 설치합니다. 몇 분 걸릴 수 있어요...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] 설치에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 실행해 주세요.
    pause
    exit /b
  )
)

echo.
echo [2/2] 프로그램을 시작합니다. 잠시 후 브라우저가 자동으로 열립니다.
echo       (종료하려면 이 검은 창을 닫으세요.)
echo.
start "" cmd /c "timeout /t 7 >nul & start http://localhost:3000"
call npm run dev
