export interface CatalogProvider {
  id: string;
  label: string;
  baseUrl: string;
  apiKeysUrl: string;
  keyHint: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDER_CATALOG: CatalogProvider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeysUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
    defaultModel: 'claude-sonnet-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeysUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
    defaultModel: 'gpt-5-mini',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeysUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza...',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiKeysUrl: 'https://console.x.ai/',
    keyHint: 'xai-...',
    defaultModel: 'grok-4-fast',
    models: ['grok-4', 'grok-4-fast', 'grok-3', 'grok-3-mini'],
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeysUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_...',
    defaultModel: 'openai/gpt-oss-120b',
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeysUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
    defaultModel: 'anthropic/claude-sonnet-5-5',
    models: [
      'anthropic/claude-sonnet-5-5',
      'openai/gpt-5',
      'google/gemini-2.5-flash',
      'x-ai/grok-4-fast',
    ],
  },
];

const ANTHROPIC_VERSION = '2023-06-01';
const SKIPPED_MODELS =
  /embed|whisper|tts|dall-e|image|audio|moderation|rerank|guard|realtime|speech|transcri|search/i;
const MODEL_LIMIT = 500;

const normalise = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '').toLowerCase();

export const findProvider = (baseUrl: string): CatalogProvider | undefined =>
  PROVIDER_CATALOG.find((provider) => normalise(provider.baseUrl) === normalise(baseUrl));

export const providerHeaders = (baseUrl: string, apiKey: string): Record<string, string> => {
  const bearer = { Authorization: `Bearer ${apiKey}` };

  if (findProvider(baseUrl)?.id === 'anthropic') {
    return { ...bearer, 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION };
  }

  return bearer;
};

export const cleanModelId = (id: string): string => id.trim().replace(/^models\//, '');

export const usableModels = (ids: string[], preferred: string[] = []): string[] => {
  const available = [...new Set(ids.map(cleanModelId))].filter(
    (id) => id.length > 0 && !SKIPPED_MODELS.test(id),
  );
  const hoisted = preferred.filter((id) => available.includes(id));
  const rest = available
    .filter((id) => !hoisted.includes(id))
    .sort((first, second) => first.localeCompare(second));

  return [...hoisted, ...rest].slice(0, MODEL_LIMIT);
};
