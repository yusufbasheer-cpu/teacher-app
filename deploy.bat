@echo off
cd /d "%~dp0"
git add .
git commit -m "deploy: %date% %time%"
git push
echo.
echo Done.
pause
