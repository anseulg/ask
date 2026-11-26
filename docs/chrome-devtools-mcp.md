# Chrome DevTools MCP

Claude가 **Chrome 브라우저를 직접 열고 조작·디버깅**할 수 있게 해 주는 Google Chrome DevTools 팀의 공식 MCP 서버입니다.

- 공식 저장소: https://github.com/ChromeDevTools/chrome-devtools-mcp (Apache-2.0)
- npm 패키지: `chrome-devtools-mcp`

## 할 수 있는 것 (도구 33개)

| 분류 | 예시 |
|---|---|
| 페이지 조작 | 페이지 열기·이동, 클릭, 입력, 폼 채우기, 파일 업로드, 드래그 |
| 화면 확인 | 스크린샷, 접근성 스냅샷, CSS 스타일 확인, 화면 녹화 |
| 디버깅 | 콘솔 메시지, 네트워크 요청 확인, JS 실행, 로그포인트 |
| 성능 | 성능 트레이스, LCP 분석, Lighthouse 감사, 힙 스냅샷(메모리 누수) |
| 환경 흉내 | 모바일 화면 크기, 느린 네트워크·CPU |

예) "localhost:8765 열어서 회의 녹음 변환기 화면 스크린샷 찍고 콘솔 에러 있는지 봐줘"

## 설치

### Claude Code — 이 저장소에서는 자동

이 저장소의 `.claude/settings.json`에 플러그인이 등록되어 있어서, 저장소를 Claude Code로 열면
마켓플레이스 추가·플러그인 설치를 물어봅니다. **허용**만 누르면 됩니다.

다른 프로젝트에서도 쓰려면 Claude Code에서:

```text
/plugin marketplace add ChromeDevTools/chrome-devtools-mcp
/plugin install chrome-devtools-mcp@chrome-devtools-plugins
```

### Claude Desktop · Cursor

MCP 설정 파일에 추가합니다.
(Claude Desktop: 설정 → 개발자 → 구성 편집 / Cursor: Settings → MCP → Add new MCP server)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

필요 조건: Node.js 20 이상, Chrome 설치.

## 자주 쓰는 옵션 (`args`에 추가)

| 옵션 | 효과 |
|---|---|
| `--headless` | 브라우저 창을 띄우지 않고 실행 |
| `--isolated` | 매번 새 임시 프로필 사용 (내 로그인·쿠키와 분리) |
| `--executablePath <경로>` | 특정 Chrome/Chromium 사용 |

## ⚠️ 주의

- Claude가 조작하는 브라우저에 열린 내용은 Claude가 볼 수 있습니다. **로그인된 사내 시스템·개인정보 페이지는 조심**하고, 필요하면 `--isolated`를 쓰세요.
- `@latest`는 항상 최신판을 받습니다. 버전을 고정하려면 `chrome-devtools-mcp@1.14.0`처럼 적습니다.
