import { normalizeActorTelemetry } from '../actor-telemetry';
import { normalizeProjectName, normalizeSkillName } from '@zenithfoundry/tech-lead-stack/trace-utils';

describe('Analytics Normalization', () => {
  describe('normalizeProjectName', () => {
    it('should normalize project names to kebab-case', () => {
      expect(normalizeProjectName('Tech Lead Stack')).toBe('tech-lead-stack');
      expect(normalizeProjectName('My Awesome Project')).toBe(
        'my-awesome-project'
      );
      expect(normalizeProjectName('already-kebab')).toBe('already-kebab');
    });

    it('should handle undefined and null', () => {
      expect(normalizeProjectName(undefined)).toBe('tech-lead-stack');
      expect(normalizeProjectName(null as any)).toBe('tech-lead-stack');
    });

    it('should handle special characters', () => {
      expect(normalizeProjectName('Project@123!')).toBe('project-123');
    });
  });

  describe('normalizeSkillName', () => {
    it('should normalize skill names', () => {
      expect(normalizeSkillName('Get Code Review')).toBe('get-code-review');
    });
  });

  describe('normalizeActorTelemetry', () => {
    it('should correctly parse standard Langfuse trace metadata structures', () => {
      const traceMetadata = {
        model: 'gemini-1.5-pro',
        source: 'mcp',
        actorType: 'AGENT',
        autonomy: 'DIRECTED',
        loopRunId: 'loop-123',
        loopPhase: 'generate',
        teamRole: 'developer',
      };

      const normalized = normalizeActorTelemetry(traceMetadata);

      expect(normalized).toEqual({
        actorType: 'AGENT',
        autonomy: 'DIRECTED',
        loopRunId: 'loop-123',
        loopPhase: 'generate',
        teamRole: 'developer',
      });
    });
  });
});
