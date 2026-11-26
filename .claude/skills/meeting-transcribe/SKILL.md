---
name: meeting-transcribe
description: 회의 녹음(m4a/mp3/wav/mp4 등)을 OpenAI Whisper로 글(txt)·자막(srt)으로 변환하고, 원하면 회의록(md)으로 정리한다. "회의 녹음 글로 바꿔줘", "자막 만들어줘", "녹취록", "회의록 만들어줘", "whisper" 등의 요청에 사용.
---

# 회의 녹음 → 글·자막·회의록

프로젝트 폴더: `meeting-transcribe/` (저장소 루트 기준). 사용법 전체는 `meeting-transcribe/README.md`.

## 1. 준비 확인
- `ffmpeg -version` 과 `python -c "import whisper"` 가 되는지 확인한다.
- 안 되면 README의 "1. 설치"대로 설치한다 (`pip install -r meeting-transcribe/requirements.txt`, ffmpeg).
- 모델 다운로드 서버(openaipublic.azureedge.net)에 접속할 수 없는 환경이면, 사용자 PC에서 실행하라고 안내한다.

## 2. 변환
```bash
python meeting-transcribe/transcribe.py [파일 또는 폴더] --model small --language Korean
```
- 인자가 없으면 `meeting-transcribe/input/` 전체를 변환하고 결과는 `meeting-transcribe/output/` 에 저장된다.
- 회사·제품·사람 이름 같은 고유명사를 사용자가 알려주면 `--prompt "용어1, 용어2"` 로 넘긴다.
- 정확도가 부족하다고 하면 `--model medium` (GPU가 있으면 `turbo`)으로 다시 실행한다.
- 녹음이 길면 오래 걸리므로 백그라운드로 실행하고 진행 상황을 알린다.

## 3. 요약본 (요청 시)
- 사용자가 버튼 화면을 원하면 `python meeting-transcribe/app.py` 실행을 안내한다 (브라우저 UI, 변환+요약 버튼).
- Claude API 키가 있으면 `python meeting-transcribe/summarize.py output/파일명.txt` 로 `output/파일명-요약.md` 를 만든다.
- 키가 없으면 `output/파일명.txt` 를 직접 읽고 `output/파일명-요약.md` 를 아래 형식으로 작성한다.

```markdown
# 회의록 — {회의 주제}
- 일시: {파일명·내용에서 추정, 모르면 빈칸}
- 참석자: {언급된 이름, 모르면 빈칸}

## 요약 (3~5줄)
## 주요 논의
## 결정 사항
## 액션 아이템
| 담당 | 할 일 | 기한 |
## 미결 / 후속 확인
```
- 녹취에 없는 내용은 지어내지 않는다. 불확실한 이름·숫자에는 `(확인 필요)` 를 붙인다.
- Whisper는 화자를 구분하지 않으므로 발언자를 단정하지 않는다.

## 주의
- 회의 녹음과 결과물은 `.gitignore` 로 커밋되지 않는다. 사용자가 원하지 않는 한 커밋·외부 업로드하지 않는다.
