// ax-bot — company-efficiency Slack bot AGENT (Bolt Socket Mode + Claude).
//
// A user asks a natural-language question in Slack; Claude decides which tool to
// call, runs it, and replies with a sourced answer. Socket Mode lets the bot
// connect over a WebSocket, so it runs locally without a public HTTP endpoint.
//
// This is a PRIVATE VALIDATION build (single user first) — keep it simple/safe.

// Load environment variables from a local .env file.
require('dotenv').config();

const { App } = require('@slack/bolt');
const { runAgent } = require('./agent');

// ---------------------------------------------------------------------------
// 1. Validate required environment variables. Fail fast, bilingual message.
// ---------------------------------------------------------------------------
const requiredEnv = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'ANTHROPIC_API_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(
    [
      '',
      '❌ 필수 환경 변수가 없습니다 / Missing required environment variables:',
      ...missingEnv.map((name) => `   - ${name}`),
      '',
      '👉 .env.example 파일을 .env 로 복사한 뒤 값을 채워주세요.',
      '   Copy .env.example to .env and fill in the values.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Optional allowlist for private validation.
//    ALLOWED_SLACK_USER_IDS is a comma-separated list of Slack user IDs.
//    If unset/empty, everyone is allowed (but we warn at startup).
// ---------------------------------------------------------------------------
const allowedUserIds = (process.env.ALLOWED_SLACK_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function isAllowed(userId) {
  if (allowedUserIds.length === 0) return true;
  return allowedUserIds.includes(userId);
}

// ---------------------------------------------------------------------------
// 3. Create the Bolt app in Socket Mode.
// ---------------------------------------------------------------------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const SEARCHING_MSG = '🔎 찾는 중이에요…';
const ERROR_MSG =
  '⚠️ 죄송해요, 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
const NOT_ALLOWED_MSG =
  '🙏 지금은 비공개 검증(private validation) 중이에요. 허용된 사용자만 사용할 수 있어요.';

// Remove the leading "<@BOTID>" mention (and any following whitespace) from text.
function stripMention(text) {
  return (text || '').replace(/<@[^>]+>\s*/, '').trim();
}

// Shared handler: ack in-thread, run the agent, reply in the same thread.
async function handleQuestion({ client, channel, threadTs, userText }) {
  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: SEARCHING_MSG,
  });

  const answer = await runAgent({ userText });

  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: answer,
  });
}

// ---------------------------------------------------------------------------
// 4. Event: app_mention — strip the mention, run the agent, reply in-thread.
// ---------------------------------------------------------------------------
app.event('app_mention', async ({ event, client }) => {
  const threadTs = event.thread_ts || event.ts;

  if (!isAllowed(event.user)) {
    try {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: NOT_ALLOWED_MSG,
      });
    } catch (error) {
      console.error('허용되지 않은 사용자 응답 실패 / Failed to reply to disallowed user:', error);
    }
    return;
  }

  try {
    await handleQuestion({
      client,
      channel: event.channel,
      threadTs,
      userText: stripMention(event.text),
    });
  } catch (error) {
    console.error('app_mention 처리 중 오류 / Error handling app_mention:', error);
    try {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: ERROR_MSG,
      });
    } catch (postError) {
      console.error('오류 메시지 전송 실패 / Failed to post error message:', postError);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Message: direct messages only (channel_type === 'im').
//    Guard against the bot's own messages, other bots, and edits/joins.
// ---------------------------------------------------------------------------
app.message(async ({ message, client }) => {
  // Ignore bot messages (incl. our own) and non-standard message subtypes.
  if (message.subtype || message.bot_id) return;
  // Only handle direct messages.
  if (message.channel_type !== 'im') return;

  const threadTs = message.thread_ts || message.ts;

  if (!isAllowed(message.user)) {
    try {
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text: NOT_ALLOWED_MSG,
      });
    } catch (error) {
      console.error('허용되지 않은 사용자 응답 실패 / Failed to reply to disallowed user:', error);
    }
    return;
  }

  try {
    await handleQuestion({
      client,
      channel: message.channel,
      threadTs,
      userText: message.text,
    });
  } catch (error) {
    console.error('DM 처리 중 오류 / Error handling direct message:', error);
    try {
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text: ERROR_MSG,
      });
    } catch (postError) {
      console.error('오류 메시지 전송 실패 / Failed to post error message:', postError);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Global error handler.
// ---------------------------------------------------------------------------
app.error(async (error) => {
  console.error('⚠️ 예기치 못한 오류 / Unhandled error:', error);
});

// ---------------------------------------------------------------------------
// 7. Start the app.
// ---------------------------------------------------------------------------
(async () => {
  try {
    if (allowedUserIds.length === 0) {
      console.warn(
        '⚠️ ALLOWED_SLACK_USER_IDS 가 비어 있습니다 — 모든 사용자가 봇을 사용할 수 있어요.\n' +
          '   비공개 검증 중에는 본인 Slack user ID 로 설정하는 것을 권장합니다.\n' +
          '   (ALLOWED_SLACK_USER_IDS is empty — everyone can use the bot. ' +
          'Set it to your own Slack user ID for private validation.)'
      );
    }
    await app.start();
    console.log('⚡️ ax-bot is running!');
  } catch (error) {
    console.error('봇 시작 실패 / Failed to start the bot:', error);
    process.exit(1);
  }
})();
