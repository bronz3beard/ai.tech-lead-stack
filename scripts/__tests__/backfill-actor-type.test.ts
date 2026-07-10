import { determineActorTelemetry } from '../backfill-actor-type';

describe('backfill-actor-type heuristics', () => {
  it('should default to HUMAN DIRECTED', () => {
    expect(
      determineActorTelemetry({ skillName: 'test', metadata: {} })
    ).toEqual({ actorType: 'HUMAN', autonomy: 'DIRECTED' });

    expect(
      determineActorTelemetry({
        skillName: 'test',
        metadata: { source: 'chat-v2' },
      })
    ).toEqual({ actorType: 'HUMAN', autonomy: 'DIRECTED' });

    expect(
      determineActorTelemetry({ skillName: 'test', metadata: null })
    ).toEqual({ actorType: 'HUMAN', autonomy: 'DIRECTED' });
  });

  it('should detect AGENT DIRECTED from mcp source', () => {
    expect(
      determineActorTelemetry({
        skillName: 'test',
        metadata: { source: 'mcp' },
      })
    ).toEqual({ actorType: 'AGENT', autonomy: 'DIRECTED' });
  });

  it('should detect AGENT AUTONOMOUS from reflexion-loop skill', () => {
    expect(
      determineActorTelemetry({ skillName: 'reflexion-loop', metadata: {} })
    ).toEqual({ actorType: 'AGENT', autonomy: 'AUTONOMOUS' });

    expect(
      determineActorTelemetry({
        skillName: 'skill:reflexion-loop',
        metadata: {},
      })
    ).toEqual({ actorType: 'AGENT', autonomy: 'AUTONOMOUS' });
  });

  it('should prioritize mcp source for AGENT DIRECTED if both match (though rare)', () => {
    expect(
      determineActorTelemetry({
        skillName: 'reflexion-loop',
        metadata: { source: 'mcp' },
      })
    ).toEqual({ actorType: 'AGENT', autonomy: 'DIRECTED' });
  });
});
