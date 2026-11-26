#!/bin/bash
# 더블클릭하면 회의 녹음 변환기 화면이 브라우저로 열립니다.
cd "$(dirname "$0")"
[ -d .venv ] && source .venv/bin/activate
python3 app.py
