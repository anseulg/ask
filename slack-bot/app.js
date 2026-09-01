// Slack bot starter — built with Bolt in Socket Mode.
// Socket Mode lets the bot connect to Slack over a WebSocket, so it can run
// locally (behind NAT / firewall) without exposing a public HTTP endpoint.

// Load environment variables from a local .env file (SLACK_BOT_TOKEN, etc.).
require('dotenv').config();

const { App } = require('@slack/bolt');

// ---------------------------------------------------------------------------
// 1. Validate required environment variables before doing anything else.
//    Fail fast with a clear, bilingual (Korean + English) message.
// ---------------------------------------------------------------------------
const requiredEnv = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(
    [
      '',
      '❌ 필수 환경 변수가 없습니다 / Missing required environment variables:',
      ...missingEnv.map((name) => `   - ${name}`),
      '',
      '👉 .env.example 파일을 .env 로 복사한 뒤 토큰을 채워주세요.',
      '   Copy .env.example to .env and fill in your tokens.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Create the Bolt app in Socket Mode.
//    - token:    Bot User OAuth Token (xoxb-...)   -> calls Slack Web API
//    - appToken: App-Level Token      (xapp-...)   -> opens the Socket Mode WS
// ---------------------------------------------------------------------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// ---------------------------------------------------------------------------
// 3. Event: app_mention
//    Fires when someone @-mentions the bot. Reply inside the same thread so
//    the conversation stays tidy.
// ---------------------------------------------------------------------------
app.event('app_mention', async ({ event, say }) => {
  try {
    // If the mention is already in a thread, keep replying there; otherwise
    // start a thread rooted at the mention message itself.
    const threadTs = event.thread_ts || event.ts;

    await say({
      thread_ts: threadTs,
      text: `안녕하세요 <@${event.user}>님! 👋 무엇을 도와드릴까요?\n(Hi <@${event.user}>! How can I help?)`,
    });
  } catch (error) {
    console.error('app_mention 처리 중 오류 / Error handling app_mention:', error);
  }
});

// ---------------------------------------------------------------------------
// 4. Message: keyword listener
//    Replies when a message contains a greeting keyword. We guard carefully
//    against reacting to bot messages (including our own) to avoid loops.
// ---------------------------------------------------------------------------
app.message(/안녕|hello|hi/i, async ({ message, say }) => {
  // `message.subtype` is set for non-standard messages (edits, bot messages,
  // joins, etc.). `message.bot_id` is present when a bot sent the message.
  // Ignore both so the bot never talks to itself or other bots.
  if (message.subtype || message.bot_id) {
    return;
  }

  try {
    await say({
      // Reply in-thread when possible so channels don't get noisy.
      thread_ts: message.thread_ts || message.ts,
      text: `안녕하세요 <@${message.user}>님! 반가워요 🙌 (Hello there!)`,
    });
  } catch (error) {
    console.error('message 처리 중 오류 / Error handling message:', error);
  }
});

// ---------------------------------------------------------------------------
// 5. Slash command: /hello
//    ack() must be called quickly (< 3s) to confirm receipt to Slack.
//    The response is only visible to the user who ran the command.
// ---------------------------------------------------------------------------
app.command('/hello', async ({ command, ack, respond }) => {
  // Acknowledge the command request first.
  await ack();

  await respond({
    response_type: 'ephemeral', // only the invoking user sees this
    text: `👋 안녕하세요 <@${command.user_id}>님! /hello 명령이 정상 동작합니다.\n(Hello <@${command.user_id}>! The /hello command works.)`,
  });
});

// ---------------------------------------------------------------------------
// 6. Global error handler — catches anything not handled in a listener.
// ---------------------------------------------------------------------------
app.error(async (error) => {
  console.error('⚠️ 예기치 못한 오류 / Unhandled error:', error);
});

// ---------------------------------------------------------------------------
// 7. Start the app.
// ---------------------------------------------------------------------------
(async () => {
  try {
    await app.start();
    console.log('⚡️ Slack bot is running!');
  } catch (error) {
    console.error('봇 시작 실패 / Failed to start the bot:', error);
    process.exit(1);
  }
})();
