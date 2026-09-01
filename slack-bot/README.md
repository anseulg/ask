# Slack Bot Starter (Bolt · Socket Mode)

[Slack Bolt](https://slack.dev/bolt-js/) 프레임워크와 **Socket Mode** 로 만든 Slack 봇 스타터입니다.
Socket Mode 를 사용하므로 public URL(공개 서버)이나 ngrok 없이도 로컬에서 바로 실행됩니다.

## 기능 (Features)

- **`app_mention`** — 봇을 `@멘션` 하면 해당 스레드(thread)에 인사말을 답장합니다.
- **키워드 메시지(message)** — 채널/DM 메시지에 `안녕`, `hello`, `hi` 가 포함되면 답장합니다.
  (봇 자신의 메시지나 다른 봇 메시지에는 반응하지 않습니다.)
- **`/hello` 슬래시 커맨드(slash command)** — 명령을 실행한 사용자에게만 보이는(ephemeral) 인사말을 보냅니다.

---

## 사전 준비 (Prerequisites)

- **Node.js >= 18**
- Slack 워크스페이스(workspace) 관리자 또는 앱 설치 권한

---

## 1. Slack App 생성 (Create a Slack app)

1. <https://api.slack.com/apps> 접속 → **Create New App** 클릭
2. **From scratch** 선택
3. App Name 입력, 설치할 **Workspace** 선택 → **Create App**

---

## 2. Socket Mode 활성화 & App-Level Token 발급

1. 왼쪽 메뉴 **Settings → Socket Mode** 이동
2. **Enable Socket Mode** 토글 ON
3. App-Level Token 생성 창이 뜨면 토큰 이름을 입력하고, **Scope** 에 `connections:write` 를 추가한 뒤 **Generate**
   - (이미 만들었다면 **Settings → Basic Information → App-Level Tokens** 에서 재확인 가능)
4. 생성된 토큰(`xapp-...`)이 **`SLACK_APP_TOKEN`** 입니다. 복사해 두세요.

---

## 3. OAuth & Permissions (Bot Token Scopes)

1. 왼쪽 메뉴 **Features → OAuth & Permissions** 이동
2. **Scopes → Bot Token Scopes** 에 아래 스코프(scope)를 추가합니다:
   - `app_mentions:read` — 멘션 이벤트 수신
   - `chat:write` — 메시지 전송
   - `commands` — 슬래시 커맨드 사용
   - `channels:history` — 공개 채널 메시지 읽기 (키워드 감지용)
   - `im:history` — DM 메시지 읽기 (키워드 감지용)
   > 참고: 메시지 이벤트를 실제로 받으려면 아래 **Event Subscriptions** 에서
   > `message.channels` / `message.im` 이벤트도 함께 구독해야 합니다.
3. 페이지 상단 **Install to Workspace** (또는 Reinstall) → 권한 승인
4. 설치 후 표시되는 **Bot User OAuth Token**(`xoxb-...`)이 **`SLACK_BOT_TOKEN`** 입니다. 복사해 두세요.

---

## 4. Event Subscriptions (이벤트 구독)

1. 왼쪽 메뉴 **Features → Event Subscriptions** 이동
2. **Enable Events** 토글 ON
   - Socket Mode 를 사용하므로 Request URL 은 입력하지 않습니다.
3. **Subscribe to bot events** 에 아래 이벤트를 추가합니다:
   - `app_mention`
   - `message.channels`
   - `message.im`
4. **Save Changes** 클릭 (스코프가 바뀌면 앱 재설치 안내가 나올 수 있습니다 → Reinstall)

---

## 5. Slash Commands (슬래시 커맨드)

1. 왼쪽 메뉴 **Features → Slash Commands** 이동
2. **Create New Command** 클릭
   - **Command:** `/hello`
   - **Short Description:** 간단한 인사 (예: "인사 테스트")
   - Socket Mode 에서는 **Request URL 이 필요 없습니다.** (필드가 있으면 아무 값이나 넣어도 무방하지만, 실제 요청은 소켓으로 전달됩니다.)
3. **Save**
4. 커맨드를 추가한 뒤에는 앱을 **Reinstall** 해야 반영됩니다.

---

## 6. 실행 (Run the bot)

```bash
# 1) .env 파일 준비
cp .env.example .env
# .env 를 열어 SLACK_BOT_TOKEN, SLACK_APP_TOKEN 값을 채웁니다.

# 2) 의존성 설치
npm install

# 3) 실행
npm start
# 또는 파일 변경 시 자동 재시작(개발용)
npm run dev
```

정상적으로 연결되면 터미널에 다음이 출력됩니다:

```
⚡️ Slack bot is running!
```

---

## 7. 테스트 (Invite & test)

1. Slack 에서 아무 채널이나 열고 봇을 초대합니다:
   ```
   /invite @your-bot-name
   ```
2. 동작 확인:
   - **멘션:** `@your-bot-name 안녕` → 봇이 스레드로 인사 답장
   - **키워드:** 채널에 `안녕` 또는 `hello` 입력 → 봇이 답장
   - **슬래시 커맨드:** `/hello` 입력 → 나에게만 보이는 인사말
   - **DM:** 봇에게 다이렉트 메시지로 `hi` 전송 → 답장
     (DM 테스트는 `im:history` + `message.im` 이 필요합니다.)

---

## 트러블슈팅 (Troubleshooting)

- **`Missing required environment variables`** — `.env` 에 두 토큰이 모두 채워졌는지 확인하세요.
- **봇이 멘션에 반응하지 않음** — `app_mention` 이벤트 구독 및 `app_mentions:read` 스코프 확인 후 **Reinstall**.
- **키워드 메시지에 반응하지 않음** — `message.channels`/`message.im` 이벤트와 `channels:history`/`im:history` 스코프 확인, 그리고 봇이 채널에 초대되었는지 확인하세요.
- **스코프/이벤트 변경 후 무반응** — 앱을 **반드시 재설치(Reinstall)** 해야 적용됩니다.
- **`not_allowed_token_type`** — App-Level Token(`xapp-`)과 Bot Token(`xoxb-`)을 서로 바꿔 넣지 않았는지 확인하세요.
