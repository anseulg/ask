// agent.js — the Claude agent loop for ax-bot.
//
// Runs a proper tool-use loop: the user's question goes to Claude with a strong
// Korean system prompt; while Claude asks to use a tool (`stop_reason ===
// 'tool_use'`), we execute the tool locally and feed the result back as a
// `tool_result`, repeating until Claude returns a final text answer.

const Anthropic = require('@anthropic-ai/sdk');
const { lookupRoadmap } = require('./roadmap');

// Anthropic client — reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Default model — a current Sonnet (per the claude-api skill). Overridable via
// ANTHROPIC_MODEL so we can bump the model without a code change.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// Guard against runaway loops: cap how many times we round-trip with the model.
const MAX_TOOL_ITERATIONS = 5;

// Tool definitions exposed to Claude.
const tools = [
  {
    name: 'lookup_roadmap',
    description:
      'AX 제품 로드맵에서 업무(task)를 검색합니다. 키워드나 담당자(owner) 이름으로 검색하며, ' +
      '각 항목의 상태(status), 목표일자(due date), 담당자(owner), Jira 키(Jira key), 링크(link)를 반환합니다. ' +
      'Search the AX product roadmap for tasks by keyword or owner; returns status, due date, owner, Jira key, and a link.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            '검색어 — 업무 제목이나 담당자 이름의 일부. Keyword to match against task title or owner.',
        },
      },
      required: ['query'],
    },
  },
];

// Korean system prompt encoding ax-bot's guardrails.
const SYSTEM_PROMPT = [
  '당신은 ax-bot 입니다. AX-TF(전사 효율화 태스크포스)의 내부 업무 효율화 어시스턴트입니다.',
  '',
  '규칙(반드시 지킬 것):',
  '- 한국어로 간결하게 답하세요.',
  '- 도구(tool) 결과에 포함된 출처 링크(link)를 답변에 항상 함께 표기하세요.',
  '- 도구로 확인할 수 없는 내용은 추측하지 말고 "모른다"라고 솔직히 말하세요.',
  '- 당신은 READ-ONLY(읽기 전용)입니다. 무언가를 생성/등록/저장했다고 절대 말하지 마세요.',
  '- 데이터를 기록(write)해야 하는 요청에는 초안(draft)만 작성하고,',
  '  실제 반영은 사람이 직접 확인해야 한다고 안내하세요.',
].join('\n');

// Local dispatch table: tool name -> implementation.
async function executeTool(name, input) {
  switch (name) {
    case 'lookup_roadmap':
      return lookupRoadmap({ query: input && input.query });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Run the agent for a single user turn and return the final text answer.
 *
 * @param {{ userText: string }} params
 * @returns {Promise<string>}
 */
async function runAgent({ userText }) {
  const messages = [{ role: 'user', content: userText }];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Persist the assistant turn (text + any tool_use blocks) verbatim.
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      // Final answer — collect and return all text blocks.
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      return text || '죄송해요, 답변을 생성하지 못했어요.';
    }

    // Execute every tool_use block and return all results in ONE user message.
    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      try {
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `도구 실행 중 오류가 발생했습니다: ${err.message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  // Exhausted the iteration cap without a final text answer.
  return '요청이 복잡해서 도구 호출 한도에 도달했어요. 질문을 조금 더 구체적으로 다시 해주실 수 있을까요?';
}

module.exports = { runAgent };
