@echo off
cd /d "%~dp0"

echo Running build check before deploy...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Nothing was committed or pushed.
  pause
  exit /b 1
)

echo.
echo Checking for env files or the OCR data file accidentally staged...
git add -A -- . ":!.env" ":!.env.*" ":!env.download"
git status --porcelain | findstr /r "^[AM].*\.env" >nul
if not errorlevel 1 (
  echo.
  echo Refusing to commit: a .env-like file is staged. Unstage it and re-run.
  pause
  exit /b 1
)

set /p MSG="Commit message: "
if "%MSG%"=="" set MSG=deploy: %date% %time%

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo Nothing to commit, or commit failed.
  pause
  exit /b 1
)

git push

echo.
echo Done.
pause
