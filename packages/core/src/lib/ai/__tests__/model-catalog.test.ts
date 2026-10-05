import { PRICING_MAP } from '../../telemetry-service';
import { MODELS } from '../constants';
import { MODEL_CATALOG, catalogEntry, providerOf } from '../model-registry';
import { PRICE_PER_MTOK } from '../reflexion/pricing';

describe('MODEL_CATALOG', () => {
  const ids = MODEL_CATALOG.map((m) => m.id);

  it('contains every default model the app routes to', () => {
    for (const id of [
      MODELS.CLAUDE,
      MODELS.OPENAI,
      MODELS.GEMINI,
      MODELS.GEMINI_FALLBACK_CRITIC,
      MODELS.JULES,
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('keeps the ids that saved Project/User routing settings still reference', () => {
    // ModelRoutingSchema rejects ids missing from the catalog, so dropping one
    // of these would break saved settings until they are migrated.
    for (const id of [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
      'gemini-3.1-pro-preview',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('has unique ids, so catalogEntry() resolves the right key slot', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(catalogEntry(MODELS.JULES)?.keySlot).toBe('jules');
    expect(catalogEntry(MODELS.GEMINI)?.keySlot).toBe('gemini');
  });

  it('maps every id to the provider family it declares', () => {
    for (const entry of MODEL_CATALOG) {
      expect(providerOf(entry.id)).toBe(entry.family);
    }
  });

  it('prices every catalog model explicitly instead of by family fallback', () => {
    const unpriced = ids.filter((id) => !PRICING_MAP[id]);
    expect(unpriced).toEqual([]);
  });
});

describe('reflexion budget pricing', () => {
  it('has a rate for every model the reflexion runner defaults to', () => {
    for (const id of [MODELS.CLAUDE, MODELS.GEMINI, MODELS.GEMINI_FALLBACK_CRITIC]) {
      expect(PRICE_PER_MTOK[id]).toBeDefined();
    }
  });
});
