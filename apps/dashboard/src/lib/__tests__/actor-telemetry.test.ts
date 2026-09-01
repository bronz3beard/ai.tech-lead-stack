import { normalizeActorTelemetry } from '../actor-telemetry';

describe('normalizeActorTelemetry', () => {
  it('should preserve valid values', () => {
    const input = {
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopRunId: 'test-run-id',
      loopPhase: 'critique',
      teamRole: 'developer',
    };
    expect(normalizeActorTelemetry(input)).toEqual(input);
  });

  it('should strip unknown fields', () => {
    const input = {
      actorType: 'HUMAN',
      unknownField: 'foo',
    };
    expect(normalizeActorTelemetry(input)).toEqual({ actorType: 'HUMAN' });
  });

  it('should discard invalid enum values', () => {
    const input = {
      actorType: 'ROBOT', // invalid
      autonomy: 'DIRECTED',
    };
    expect(normalizeActorTelemetry(input)).toEqual({ autonomy: 'DIRECTED' });
  });

  it('should handle non-object input', () => {
    expect(normalizeActorTelemetry(null)).toEqual({});
    expect(normalizeActorTelemetry('string')).toEqual({});
  });

  it('should handle missing fields', () => {
    const input = {
      actorType: 'AGENT',
    };
    expect(normalizeActorTelemetry(input)).toEqual({ actorType: 'AGENT' });
  });
});
