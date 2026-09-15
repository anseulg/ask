# Claude Code 스킬

이 폴더의 스킬은 이 저장소에서 Claude Code 세션을 열면 자동으로 인식됩니다.

## html-deck 계열

| 스킬 | 역할 | 출처 |
|---|---|---|
| `html-deck` | 장면(step) 기반 HTML 발표자료 생성 | https://github.com/tonywjs/html-deck |
| `html-diagram` | 편집 가능한 HTML 도식 생성 + 편집 엔진 원본 | https://github.com/tonywjs/html-diagram |

`html-deck`은 `html-diagram`을 전제로 합니다(도식 규약과 편집 엔진). 두 폴더가 나란히 있어야
조립 스크립트가 엔진을 찾습니다.

원본 저장소에서 `SKILL.md`, `assets/`, `examples/`, `README.md`, `LICENSE`만 가져왔습니다.
모델 비교 자료(`compare/`, 약 49MB)와 README용 스크린샷(`docs/`)은 스킬 동작에 필요 없어 제외했습니다.

```bash
python3 .claude/skills/html-deck/assets/build-template.py 소스.html 산출.html
python3 .claude/skills/html-deck/assets/static-check.py 산출.html
```

## ui-ux-pro-max 계열

출처: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (v2.13.0, MIT)

공식 설치 도구 `npx ui-ux-pro-max-cli init --ai claude`가 생성한 7개 스킬을 그대로 넣었습니다.
저장소를 통째로 복사한 것이 아니라 CLI 산출물이라, 플랫폼별 올바른 파일 구조와 경량 에셋을 씁니다
(저장소의 `ui-styling`은 5.8MB지만 CLI 산출물은 220KB입니다).

| 스킬 | 역할 |
|---|---|
| `ui-ux-pro-max` | 핵심 스킬. 79개 스타일·192개 팔레트·74개 폰트 조합·119개 UX 지침·25개 차트·22개 스택의 로컬 검색 DB |
| `design` | 로고·CI·배너·아이콘·슬라이드를 아우르는 통합 디자인 |
| `design-system` | 디자인 토큰 3계층(primitive→semantic→component), 컴포넌트 명세 |
| `brand` | 브랜드 보이스, 비주얼 아이덴티티, 메시징 프레임워크 |
| `slides` | Chart.js 기반 HTML 프레젠테이션 |
| `banner-design` | 소셜·광고·웹 히어로·인쇄용 배너 |
| `ui-styling` | shadcn/ui + Tailwind 기반 UI 구현 |

검색 스크립트에는 Python 3.x가 필요합니다. 표준 라이브러리만 쓰고 네트워크 요청을 보내지 않습니다.

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "saas landing page" --domain style
```

### 이름 충돌 주의

**`design`은 현재 로드되지 않습니다.** Claude Code가 기본 제공하는 `design` 스킬(디자인 캔버스)이
같은 이름을 선점하고 있어, 설치 후 스킬 목록에 나머지 여섯 개만 올라옵니다. 이 스킬의 기능 대부분은
`banner-design`·`slides`·`design-system`·`brand`에 나뉘어 들어 있으므로 실질적인 손실은 적습니다.
굳이 쓰려면 폴더 이름을 `uupm-design` 같은 다른 이름으로 바꾸고 `SKILL.md`의 `name:`도 함께 고치세요.

`slides`와 `design-system`은 로드되지만 위의 `html-deck`과 발표자료 영역이 겹칩니다. 요청 내용에 따라
둘 중 하나가 잡히므로, 원하는 쪽을 `/html-deck`이나 `/slides`로 직접 부르는 편이 확실합니다.

겹치는 스킬이 문제가 되면 해당 폴더만 지우면 됩니다. `ui-ux-pro-max` 본체는 다른 여섯 개 없이도
동작합니다.

## 다른 환경에 설치하기

이 저장소 밖에서도 쓰려면 원본을 직접 받는 쪽이 갱신에 유리합니다.

```bash
# html-deck 계열
git clone https://github.com/tonywjs/html-diagram.git ~/.claude/skills/html-diagram
git clone https://github.com/tonywjs/html-deck.git ~/.claude/skills/html-deck

# ui-ux-pro-max 계열 (Claude Code 마켓플레이스)
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

# 또는 CLI
npx ui-ux-pro-max-cli init --ai claude
```

Codex CLI는 `~/.agents/skills/`를 읽습니다.

모든 스킬이 MIT 라이선스입니다.
