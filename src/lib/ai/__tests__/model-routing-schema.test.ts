import {
  RESPONSIBILITIES,
  ModelRoutingSchema,
  getModelOptions,
} from '../model-routing-schema';
import { MODEL_CATALOG } from '../model-registry';

describe('model-routing-schema', () => {
  it('defines the correct fixed responsibilities', () => {
    expect(RESPONSIBILITIES).toEqual([
      'planner',
      'implementer',
      'auditor',
      'adjudicator',
    ]);
  });

  it('validates a routing object with known model ids', () => {
    const validConfig = {
      planner: 'gemini-3.5-flash',
      auditor: 'claude-opus-4-6',
      implementer: '',
    };
    const res = ModelRoutingSchema.safeParse(validConfig);
    expect(res.success).toBe(true);
  });

  it('fails validation when a routing object has an unknown model id', () => {
    const invalidConfig = {
      planner: 'unknown-model-xyz',
    };
    const res = ModelRoutingSchema.safeParse(invalidConfig);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('Unknown model id');
    }
  });

  it('returns formatted options for UI dropdowns including inherit default', () => {
    const options = getModelOptions();
    expect(options[0]).toEqual({
      value: '',
      label: 'Inherit / system default',
    });
    expect(options.length).toBe(MODEL_CATALOG.length + 1);
    expect(options[1]).toEqual({
      value: MODEL_CATALOG[0].id,
      label: MODEL_CATALOG[0].label,
      keySlot: MODEL_CATALOG[0].keySlot,
    });
  });
});
