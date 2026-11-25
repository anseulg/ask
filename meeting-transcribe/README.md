# 🎙️ 회의 녹음 → 글·자막 변환 (Whisper)

회의 녹음 파일을 **글(txt)** 과 **자막(srt)** 으로 바꾸는 프로젝트입니다.
OpenAI Whisper를 **내 컴퓨터에서** 돌리기 때문에 녹음이 외부 서버로 나가지 않습니다.

## 1. 설치 (처음 한 번)

| 준비물 | macOS | Windows |
|---|---|---|
| Python 3.9+ | `brew install python` | [python.org](https://www.python.org/downloads/) (설치 시 "Add to PATH" 체크) |
| ffmpeg | `brew install ffmpeg` | `winget install ffmpeg` |

```bash
cd meeting-transcribe
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # openai-whisper
```

## 2. 사용법

### 가장 간단한 방법: 명령 한 줄

```bash
whisper 회의.m4a --model small --language Korean
```

같은 폴더에 `회의.txt`, `회의.srt` 등이 생깁니다.
(txt와 srt만 원하면 `--output_format txt` 처럼 하나씩 지정하거나, 아래 스크립트를 쓰세요.)

### 프로젝트 방식: 폴더에 넣고 한 번에 변환

1. 녹음 파일을 `input/` 폴더에 넣습니다 (m4a, mp3, wav, mp4, webm 등).
2. 실행합니다.
   ```bash
   python transcribe.py
   ```
3. `output/` 폴더에 `파일명.txt` 와 `파일명.srt` 가 생깁니다.

유용한 옵션:

```bash
python transcribe.py 회의.m4a                   # 파일 하나만
python transcribe.py --model medium             # 더 정확하게 (느림)
python transcribe.py --prompt "11번가, PDP, AX TF, 지라"   # 고유명사·용어 인식률 향상
python transcribe.py --formats txt,srt,vtt      # 웹 자막(vtt)도 함께
```

> `input/`, `output/` 내용은 `.gitignore`로 막아 두어 회의 녹음과 내용이 저장소에 올라가지 않습니다.

## 3. 모델 고르기

| 모델 | 속도 | 정확도 | 권장 상황 |
|---|---|---|---|
| `tiny` / `base` | 매우 빠름 | 낮음 | 테스트용 |
| **`small`** | 빠름 | 괜찮음 | **기본값, 일반 회의** |
| `medium` | 느림 | 높음 | 전문용어가 많을 때 |
| `turbo` | 빠름 | 높음 | GPU가 있을 때 추천 |
| `large` | 가장 느림 | 가장 높음 | 중요한 회의, GPU 필요 |

첫 실행 때 모델이 자동으로 내려받아집니다 (small 약 460MB).
CPU만으로는 small 모델 기준 녹음 1시간에 수십 분 정도 걸릴 수 있습니다.

## 4. 회의록까지 만들기 (Claude Code)

이 저장소에는 `meeting-transcribe` 스킬이 들어 있습니다. Claude Code에서
"input에 있는 회의 녹음 회의록으로 만들어줘"라고 하면 변환 → 요약 → 회의록(`output/파일명-회의록.md`)까지 진행합니다.

## 자주 묻는 질문

- **`ffmpeg not found`** → 1번의 ffmpeg 설치를 확인하세요.
- **`FP16 is not supported on CPU` 경고** → 무시해도 됩니다 (CPU에서는 FP32로 자동 전환).
- **화자 구분(누가 말했는지)** → Whisper 자체 기능에는 없습니다. 회의록 단계에서 맥락으로 추정하거나, 필요하면 pyannote 같은 도구를 추가해야 합니다.
