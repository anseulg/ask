@echo off
rem 더블클릭하면 회의 녹음 변환기 화면이 브라우저로 열립니다.
chcp 65001 >nul
cd /d "%~dp0"
if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat
python app.py
pause
