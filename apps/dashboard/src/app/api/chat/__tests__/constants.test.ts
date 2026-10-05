import { MODELS as CORE_MODELS } from '@zenithfoundry/tech-lead-stack/ai/constants';
import { MODELS } from '../constants';

describe('chat MODELS', () => {
  it('matches the core package so the dashboard and the engine use the same model ids', () => {
    expect(MODELS).toEqual(CORE_MODELS);
  });
});
