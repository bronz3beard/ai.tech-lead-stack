const { extractRunIdMarker, extractProcessedCommentIdMarker, formatRunnerComment, extractYamlBlock, validateAnswers } = require('../reflexion-issue-runner-utils.js');

describe('reflexion-issue-runner-utils', () => {
  describe('extractRunIdMarker', () => {
    it('should extract a valid marker', () => {
      const body = "Some text\n<!-- reflexion-run:987654321 -->\nMore text";
      expect(extractRunIdMarker(body)).toBe("987654321");
    });
  });

  describe('extractProcessedCommentIdMarker', () => {
    it('should extract a valid marker', () => {
      const body = "Some text\n<!-- processed-comment-id:444555 -->\nMore text";
      expect(extractProcessedCommentIdMarker(body)).toBe("444555");
    });
  });

  describe('formatRunnerComment', () => {
    it('should format a diagnostic error message', () => {
      const result = formatRunnerComment({
        runId: "123",
        diagnostic: "Something went wrong"
      });
      expect(result).toContain('<!-- reflexion-run:123 -->');
      expect(result).toContain('### 🚨 Reflexion Loop Error');
    });

    it('should include processed-comment-id marker', () => {
      const result = formatRunnerComment({
        runId: "123",
        triggeringCommentId: "888",
        diagnostic: "Something went wrong"
      });
      expect(result).toContain('<!-- processed-comment-id:888 -->');
    });
  });

  describe('extractYamlBlock', () => {
    it('should extract a standard yaml block', () => {
      const body = "Here is the yaml:\n```yaml\nfoo: bar\n```";
      expect(extractYamlBlock(body).trim()).toBe("foo: bar");
    });
  });

  describe('validateAnswers', () => {
    it('validates correct answers structure', () => {
      const valid = {
        runId: "987",
        decisions: [{ id: "q1", answer: "because" }]
      };
      const res = validateAnswers(valid);
      expect(res.success).toBe(true);
    });

    it('validates directive only', () => {
      const valid = {
        runId: "987",
        directive: "approve"
      };
      const res = validateAnswers(valid);
      expect(res.success).toBe(true);
    });

    it('fails on missing runId', () => {
      const invalid = {
        decisions: [{ id: "q1", answer: "because" }]
      };
      const res = validateAnswers(invalid);
      expect(res.success).toBe(false);
    });
  });
});
