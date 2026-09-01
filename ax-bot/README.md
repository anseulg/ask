# ax-bot (전사 효율화 봇 에이전트)

**ax-bot** 은 AX-TF(전사 효율화 태스크포스)를 위한 **전사 효율화 봇 에이전트**입니다.
사용자가 Slack 에서 자연어로 질문하면, Claude 가 어떤 도구(tool)를 호출할지 스스로
결정하고 실행한 뒤, **출처 링크와 함께** 답변합니다.

> 현재는 **비공개 단일 사용자 검증(private single-user validation)** 단계입니다.

---

## 아키텍처 (Architecture)

```
Slack (Bolt · Socket Mode)  →  Claude 에이전트 (tool-use 루프)  →  도구(tools)
```

- **Slack (Bolt · Socket Mode):** public URL 없이 WebSocket 으로 연결 (`app.js`).
- **Claude 에이전트 (tool-use 루프):** 질문을 받아 도구를 선택/실행하고 최종 답변을
  생성합니다 (`agent.js`). 모델은 현재 Sonnet(`claude-sonnet-5`)을 기본값으로 사용합니다.
- **Phase 1 도구 = 로드맵 조회(roadmap lookup)** (`roadmap.js`):
  키워드/담당자로 AX 제품 로드맵을 검색해 상태·목표일자·담당자·Jira 키·링크를 반환합니다.
  - **지금은 더미(dummy) 데이터**를 반환합니다.
  - **실제 `roadmap_kv` MariaDB 쿼리는 스키마 확정 대기 중**입니다. `roadmap_kv` 는
    key-value 테이블로 보이므로, 실제 쿼리는 key/value 행을 task 단위로 pivot 해야 할
    가능성이 높습니다. (`roadmap.js` 의 TODO 참고)

---

## 가드레일 (Guardrails)

ax-bot 은 다음 규칙을 시스템 프롬프트로 강제합니다:

- 한국어로 **간결하게** 답합니다.
- 도구 결과의 **출처 링크(link)를 항상 표기**합니다.
- 도구로 알 수 없는 것은 추측하지 않고 **"모른다"**라고 답합니다.
- **READ-ONLY(읽기 전용)** — 무언가를 생성/등록/저장했다고 절대 말하지 않습니다.
- 쓰기(write)가 필요한 요청은 **초안(draft)만** 작성하고, 실제 반영은 **사람이 직접
  확인**해야 한다고 안내합니다.

---

## 사전 준비 (Prerequisites)

- **Node.js >= 18**
- Slack 워크스페이스 앱 설치 권한
- **Anthropic API key**

---

## 1. Slack App 생성 (Create a Slack app)

1. <https://api.slack.com/apps> → **Create New App** → **From scratch**
2. App Name 입력, 설치할 **Workspace** 선택 → **Create App**

## 2. Socket Mode 활성화 & App-Level Token 발급

1. **Settings → Socket Mode** → **Enable Socket Mode** 토글 ON
2. App-Level Token 생성 시 **Scope** 에 `connections:write` 추가 → **Generate**
3. 생성된 토큰(`xapp-...`)이 **`SLACK_APP_TOKEN`** 입니다.

## 3. OAuth & Permissions (Bot Token Scopes)

**Features → OAuth & Permissions → Bot Token Scopes** 에 다음을 추가합니다:

- `app_mentions:read` — 멘션 이벤트 수신
- `chat:write` — 메시지 전송
- `im:history` — DM 메시지 읽기
- `channels:history` — 공개 채널 메시지 읽기

그 다음 **Install to Workspace** → 승인. 표시되는 **Bot User OAuth Token**(`xoxb-...`)이
**`SLACK_BOT_TOKEN`** 입니다.

## 4. Event Subscriptions (이벤트 구독)

1. **Features → Event Subscriptions** → **Enable Events** 토글 ON
   - Socket Mode 이므로 Request URL 은 필요 없습니다.
2. **Subscribe to bot events** 에 다음을 추가:
   - `app_mention`
   - `message.im`
3. **Save Changes** (스코프/이벤트가 바뀌면 앱을 **Reinstall**)

> 참고: 이전의 `/hello` **슬래시 커맨드는 더 이상 필요 없습니다.** 에이전트가 대체합니다.

---

## 5. Anthropic API key & 모델 설정

1. <https://console.anthropic.com/> 에서 **API key** 를 발급받아 `ANTHROPIC_API_KEY` 에 설정합니다.
2. (선택) `ANTHROPIC_MODEL` 로 모델을 바꿀 수 있습니다. 기본값은 `claude-sonnet-5` 입니다.

## 6. 접근 제어 (private validation)

- `ALLOWED_SLACK_USER_IDS` 에 **본인 Slack user ID** 를 설정하세요(쉼표로 여러 명 지정 가능).
  비워두면 모든 사용자가 사용할 수 있으며, 시작 시 경고가 출력됩니다.
- 본인 user ID 는 Slack 프로필 → **Copy member ID** 로 확인할 수 있습니다 (예: `U0123ABC`).

---

## 7. 실행 (Run the bot)

```bash
# 1) .env 파일 준비
cp .env.example .env
# .env 를 열어 SLACK_BOT_TOKEN, SLACK_APP_TOKEN, ANTHROPIC_API_KEY 등을 채웁니다.

# 2) 의존성 설치
npm install

# 3) 실행
npm start
# 또는 개발용(파일 변경 시 자동 재시작)
npm run dev
```

정상 연결 시 터미널에 다음이 출력됩니다:

```
⚡️ ax-bot is running!
```

## 8. 테스트 (Invite & test)

1. 채널에 봇 초대: `/invite @ax-bot`
2. 동작 확인:
   - **멘션:** `@ax-bot 쿠폰 대량업로드 상태 알려줘` → 스레드로 답변
   - **DM:** 봇에게 다이렉트 메시지로 질문 → 답변
     (DM 은 `im:history` + `message.im` 이 필요합니다.)

---

## 로드맵 (Phases)

1. **Phase 1 — 조회(Lookup):** 자연어로 로드맵/데이터를 조회. (현재 단계)
2. **Phase 2 — 초안(Draft):** 요청에 대한 초안을 생성하되, 실제 반영은 사람이 확인.
3. **Phase 3 — 감시(Watch):** 상태 변화·지연 등을 능동적으로 감시하고 알림.

---

## 트러블슈팅 (Troubleshooting)

- **`Missing required environment variables`** — `.env` 에 `SLACK_BOT_TOKEN`,
  `SLACK_APP_TOKEN`, `ANTHROPIC_API_KEY` 가 모두 채워졌는지 확인하세요.
- **멘션에 무반응** — `app_mention` 구독 + `app_mentions:read` 스코프 확인 후 **Reinstall**.
- **DM 에 무반응** — `message.im` 이벤트 + `im:history` 스코프 확인.
- **스코프/이벤트 변경 후 무반응** — 앱을 **반드시 Reinstall** 하세요.
- **`not_allowed_token_type`** — `xapp-`(App-Level)과 `xoxb-`(Bot)를 바꿔 넣지 않았는지 확인하세요.
