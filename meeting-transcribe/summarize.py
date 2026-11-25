#!/usr/bin/env python3
"""녹취록(txt) → 회의 요약본(md) 생성 (Claude API).

사용 예:
    python summarize.py output/회의.txt
필요: pip install anthropic, 그리고 ANTHROPIC_API_KEY 환경변수 (또는 `ant auth login`)
"""
import sys
from pathlib import Path

MODEL = "claude-opus-5-5"

SYSTEM = """너는 회의 녹취록을 한국어 회의 요약본으로 정리하는 비서다.
규칙:
- 녹취에 없는 내용은 지어내지 않는다. 불확실한 이름·숫자·날짜에는 "(확인 필요)"를 붙인다.
- 녹취록은 음성 인식 결과라 오탈자가 있을 수 있다. 맥락상 명백하면 바로잡되 의미를 바꾸지 않는다.
- 화자 구분 정보가 없으므로 발언자를 단정하지 않는다.
- 아래 마크다운 형식만 출력한다. 해당 내용이 없는 섹션은 "- 없음"으로 둔다.

# 회의 요약 — {한 줄 주제}

## 한눈에 보기
(3~5줄 핵심 요약)

## 주요 논의
- 주제별 bullet

## 결정 사항
- ...

## 액션 아이템
| 담당 | 할 일 | 기한 |
|---|---|---|

## 미결 / 후속 확인
- ..."""


def summarize(txt_path, terms=None, log=print):
    import anthropic

    txt_path = Path(txt_path)
    transcript = txt_path.read_text(encoding="utf-8").strip()
    if not transcript:
        raise ValueError(f"녹취록이 비어 있습니다: {txt_path.name}")

    user = f"회의 녹음 파일명: {txt_path.stem}\n"
    if terms:
        user += f"참고 용어(정확한 표기): {terms}\n"
    user += f"\n<transcript>\n{transcript}\n</transcript>\n\n위 녹취록을 회의 요약본으로 정리해 줘."

    log(f"Claude로 요약 중… ({txt_path.name})")
    client = anthropic.Anthropic()
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=SYSTEM,
        output_config={"effort": "medium"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",  # 정책 거절 시 서버가 대체 모델로 자동 재시도
        messages=[{"role": "user", "content": user}],
    ) as stream:
        msg = stream.get_final_message()

    if msg.stop_reason == "refusal":
        raise RuntimeError("Claude가 이 녹취록 요약을 거절했습니다.")
    text = "".join(b.text for b in msg.content if b.type == "text").strip()
    if msg.stop_reason == "max_tokens":
        text += "\n\n> ⚠️ 요약이 길어 중간에 잘렸습니다."

    out = txt_path.with_name(f"{txt_path.stem}-요약.md")
    out.write_text(text + "\n", encoding="utf-8")
    log(f"   ✅ {out.name}")
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    import anthropic
    try:
        for p in sys.argv[1:]:
            summarize(p)
    except anthropic.AuthenticationError:
        print("API 키가 없거나 잘못됐습니다. ANTHROPIC_API_KEY를 설정하세요.")
        return 1
    except anthropic.APIConnectionError:
        print("인터넷 연결을 확인하세요.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
