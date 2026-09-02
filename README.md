# PM과정 실습

이 파일은 정말 어렵게 만들어졌습니다.

```
var code = "Hello";
alert(code);
```

## 아키텍처 다이어그램

`docs/architecture.html` — 이 저장소의 런타임 구조를 담은 단일 파일 HTML 다이어그램입니다.
브라우저로 바로 열면 되고, 검색 / 관계 추적 / 라이트·다크 전환 / PNG·SVG 내보내기를 지원합니다.

- 명세: `docs/architecture.json` (Archify architecture 스키마, `d15f8c5` 기준 코드 근거 12건 검증)
- 생성 도구: [Archify](https://github.com/tt-a1i/archify) — `.claude/skills/archify`에 설치되어 있습니다
- 재생성 (저장소 루트에서):

```bash
node .claude/skills/archify/bin/archify.mjs deliver architecture \
  docs/architecture.json docs/architecture.html --quality showcase --repo-root .
```
