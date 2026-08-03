export type RecipeGoal = 'focus' | 'meditation' | 'return_to_sleep' | 'emotional_settling' | 'sleep';
export type RecipeEnvironment = 'ocean' | 'rain' | 'forest' | 'fire' | 'auto';

export type RecipeIntent = {
  goal: RecipeGoal;
  environment: RecipeEnvironment;
  explanation: string;
  provider: 'deepseek' | 'openai' | 'rules';
  model: string | null;
};

const goals = new Set<RecipeGoal>(['focus', 'meditation', 'return_to_sleep', 'emotional_settling', 'sleep']);
const environments = new Set<RecipeEnvironment>(['ocean', 'rain', 'forest', 'fire', 'auto']);

export const classifyRecipeIntentWithRules = (prompt: string): RecipeIntent => {
  const lower = prompt.toLowerCase();
  const hasAny = (...terms: string[]) => terms.some((term) => lower.includes(term));
  const goal: RecipeGoal = hasAny('focus', 'study', 'concentrate', '专注', '学习', '集中注意')
    ? 'focus'
    : hasAny('meditation', 'meditate', 'breath', 'yoga', '冥想', '呼吸', '正念')
      ? 'meditation'
      : hasAny('wake', 'woke', 'back to sleep', '夜醒', '半夜醒', '重新入睡', '回睡')
        ? 'return_to_sleep'
        : hasAny('stress', 'anxious', 'anxiety', 'overwhelmed', '压力', '焦虑', '烦躁', '情绪')
          ? 'emotional_settling'
          : 'sleep';
  const environment: RecipeEnvironment = hasAny('ocean', 'sea', 'wave', '海浪', '大海', '海边')
    ? 'ocean'
    : hasAny('rain', 'storm', '雨', '下雨', '雨夜')
      ? 'rain'
      : hasAny('forest', 'nature', 'river', '森林', '自然', '河流', '树林')
        ? 'forest'
        : hasAny('fire', 'campfire', 'cozy', '篝火', '壁炉', '温暖')
          ? 'fire'
          : 'auto';

  return {
    goal,
    environment,
    explanation: 'Classified with the local deterministic fallback.',
    provider: 'rules',
    model: null,
  };
};

const extractResponseText = (response: any) => {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain structured output text.');
};

const getProviderConfig = () => {
  const apiKey = process.env.AI_RECIPE_API_KEY ?? process.env.OPENAI_API_KEY;
  const provider = (process.env.AI_RECIPE_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'rules')).toLowerCase();
  return {
    apiKey,
    provider: provider === 'deepseek' ? 'deepseek' : provider === 'openai' ? 'openai' : 'rules',
    baseUrl: (process.env.AI_RECIPE_BASE_URL ?? (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com')).replace(/\/$/, ''),
    model: process.env.AI_RECIPE_MODEL ?? process.env.OPENAI_RECIPE_MODEL ?? (provider === 'deepseek' ? 'deepseek-v4-pro' : 'gpt-5-mini'),
    timeoutMs: Number(process.env.AI_RECIPE_TIMEOUT_MS ?? process.env.OPENAI_RECIPE_TIMEOUT_MS ?? 8000),
    maxTokens: Number(process.env.AI_RECIPE_MAX_TOKENS ?? 1200),
  } as const;
};

export type StructuredAiResult<T> = {
  data: T;
  provider: 'deepseek' | 'openai';
  model: string;
};

export const requestStructuredAiJson = async <T>(input: {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<StructuredAiResult<T> | null> => {
  const config = getProviderConfig();
  if (!config.apiKey || config.provider === 'rules') return null;
  const isDeepSeek = config.provider === 'deepseek';
  const response = await fetch(isDeepSeek ? `${config.baseUrl}/chat/completions` : `${config.baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(isDeepSeek ? {
      model: config.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0,
      max_tokens: input.maxTokens ?? config.maxTokens,
    } : {
      model: config.model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: input.systemPrompt }] },
        { role: 'user', content: [{ type: 'input_text', text: input.userPrompt }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
      max_output_tokens: input.maxTokens ?? config.maxTokens,
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? config.timeoutMs),
  });
  if (!response.ok) throw new Error(`${config.provider} request failed with status ${response.status}.`);
  const responseBody = await response.json();
  const finishReason = isDeepSeek ? responseBody.choices?.[0]?.finish_reason : null;
  const responseText = isDeepSeek ? responseBody.choices?.[0]?.message?.content : extractResponseText(responseBody);
  if (typeof responseText !== 'string' || !responseText.trim()) {
    throw new Error(`${config.provider} response did not contain JSON text${finishReason ? ` (${finishReason})` : ''}.`);
  }
  try {
    return { data: JSON.parse(responseText) as T, provider: config.provider, model: config.model };
  } catch (error) {
    throw new Error(`${config.provider} returned invalid JSON${finishReason ? ` (${finishReason})` : ''}: ${error instanceof Error ? error.message : error}`);
  }
};

export const getAiRecipeStatus = () => {
  const config = getProviderConfig();
  return {
    provider: config.apiKey ? config.provider : 'rules',
    model: config.apiKey ? config.model : null,
    fallback: 'rules',
    ready: true,
  };
};

export const classifyRecipeIntent = async (prompt: string): Promise<RecipeIntent> => {
  const config = getProviderConfig();
  if (!config.apiKey || config.provider === 'rules') return classifyRecipeIntentWithRules(prompt);

  try {
    const systemPrompt = 'Classify a sleep soundscape request. Do not make medical claims. Return JSON only with goal, environment, and a short explanation. Goal must be one of: focus, meditation, return_to_sleep, emotional_settling, sleep. Environment must be one of: ocean, rain, forest, fire, auto. Choose ocean, rain, forest, or fire only when the user explicitly names that environment or an unambiguous synonym. Never invent an environment from mood. If no environment is explicitly requested, environment must be auto.';
    const isDeepSeek = config.provider === 'deepseek';
    const response = await fetch(isDeepSeek ? `${config.baseUrl}/chat/completions` : `${config.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(isDeepSeek ? {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0,
        max_tokens: config.maxTokens,
      } : {
        model: config.model,
        input: [
          {
            role: 'system',
            content: [{
              type: 'input_text',
              text: systemPrompt,
            }],
          },
          { role: 'user', content: [{ type: 'input_text', text: prompt }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'soundscape_intent',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                goal: { type: 'string', enum: [...goals] },
                environment: { type: 'string', enum: [...environments] },
                explanation: { type: 'string', maxLength: 180 },
              },
              required: ['goal', 'environment', 'explanation'],
            },
          },
        },
        max_output_tokens: config.maxTokens,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) throw new Error(`${config.provider} request failed with status ${response.status}.`);
    const responseBody = await response.json();
    const responseText = isDeepSeek ? responseBody.choices?.[0]?.message?.content : extractResponseText(responseBody);
    if (typeof responseText !== 'string') throw new Error(`${config.provider} response did not contain JSON text.`);
    const parsed = JSON.parse(responseText);
    if (!goals.has(parsed.goal) || !environments.has(parsed.environment) || typeof parsed.explanation !== 'string') {
      throw new Error(`${config.provider} returned an invalid recipe classification.`);
    }

    return { ...parsed, provider: config.provider, model: config.model };
  } catch (error) {
    console.warn('AI recipe classification failed; using rules fallback:', error instanceof Error ? error.message : error);
    return classifyRecipeIntentWithRules(prompt);
  }
};
