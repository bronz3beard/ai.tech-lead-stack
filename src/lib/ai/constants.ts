export const MODELS = {
  GEMINI: 'gemini-3.6-flash',
  FALLBACK_GEMINI: 'gemini-2.5-flash',
  GEMINI_FALLBACK_CRITIC: 'gemini-3.1-pro-preview',
  CLAUDE: 'claude-sonnet-4-6',
  OPENAI: 'gpt-5.4',
  JULES: 'gemini-3.1-pro',
  FALLBACK_JULES: 'gemini-3.1-flash',
} as const;

export type ModelProvider = 'gemini' | 'claude' | 'openai' | 'jules';
