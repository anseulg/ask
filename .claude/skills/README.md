# Claude Code 스킬

이 폴더의 스킬은 이 저장소에서 Claude Code 세션을 열면 자동으로 인식됩니다.

| 스킬 | 역할 | 출처 |
|---|---|---|
| `html-deck` | 장면(step) 기반 HTML 발표자료 생성 | https://github.com/tonywjs/html-deck |
| `html-diagram` | 편집 가능한 HTML 도식 생성 + 편집 엔진 원본 | https://github.com/tonywjs/html-diagram |

`html-deck`은 `html-diagram`을 전제로 합니다(도식 규약과 편집 엔진). 두 폴더가 나란히 있어야
조립 스크립트가 엔진을 찾습니다.

원본 저장소에서 `SKILL.md`, `assets/`, `examples/`, `README.md`, `LICENSE`만 가져왔습니다.
모델 비교 자료(`compare/`, 약 49MB)와 README용 스크린샷(`docs/`)은 스킬 동작에 필요 없어 제외했습니다.

## 다른 환경에 설치하기

이 저장소 밖에서도 쓰려면 원본을 직접 받는 쪽이 갱신에 유리합니다.

```bash
git clone https://github.com/tonywjs/html-diagram.git ~/.claude/skills/html-diagram
git clone https://github.com/tonywjs/html-deck.git ~/.claude/skills/html-deck
```

Codex CLI는 `~/.agents/skills/`를 읽습니다.

## 사용

발표자료·슬라이드 요청이면 Claude Code가 `html-deck`을 자동으로 씁니다. `/html-deck`으로 직접
부를 수도 있습니다. 산출 절차는 소스 작성 → 조립 → 정적 검사 순입니다.

```bash
python3 .claude/skills/html-deck/assets/build-template.py 소스.html 산출.html
python3 .claude/skills/html-deck/assets/static-check.py 산출.html
```

두 스킬 모두 MIT 라이선스입니다.
