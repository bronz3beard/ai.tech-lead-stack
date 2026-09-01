import { providerOf } from './model-registry';

export interface ModelCapabilities {
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  supportsPromptCache: boolean;
}

const CAPABILITIES_BY_ID: Record<string, Partial<ModelCapabilities>> = {
  // specific models that might lack capabilities e.g. o1-preview
  'o1-preview': {
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    supportsPromptCache: false,
  },
  'o1-mini': {
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    supportsPromptCache: false,
  }
};

const CAPABILITIES_BY_FAMILY: Record<string, Partial<ModelCapabilities>> = {
  'anthropic': {
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    supportsPromptCache: true,
  },
  'google': {
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    supportsPromptCache: true,
  },
  'openai': {
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    supportsPromptCache: false,
  }
};

/**
 * Returns the capabilities of a given model ID.
 * Falls back to family-level capabilities if the specific ID is not listed.
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  const family = providerOf(modelId);
  const familyCaps = CAPABILITIES_BY_FAMILY[family] || {};
  const idCaps = CAPABILITIES_BY_ID[modelId] || {};

  return {
    supportsStructuredOutput: true, // safe default
    supportsToolCalling: true,
    supportsPromptCache: false,
    ...familyCaps,
    ...idCaps,
  };
}

/**
 * Guards against routing an incapable model to a structural critic role.
 * Throws a clear configuration error if the model cannot reliably produce structured output.
 */
export function assertCanCritique(modelId: string): void {
  const caps = getModelCapabilities(modelId);
  if (!caps.supportsStructuredOutput) {
    throw new Error(`Configuration Error: Model "${modelId}" cannot be used as a critic because it lacks reliable structured output support.`);
  }
}
