import { isSkillTrace } from "../trace-utils";

describe("isSkillTrace", () => {
  it("should return true when name is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace("skill")).toBe(true);
    expect(isSkillTrace("skill.md")).toBe(true);
  });

  it("should return true when skillName is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace(undefined, "skill")).toBe(true);
    expect(isSkillTrace("other", "skill.md")).toBe(true);
  });

  it("should return true when name or skillName are case variants of forbidden strings", () => {
    expect(isSkillTrace("SKILL")).toBe(true);
    expect(isSkillTrace("Skill.md")).toBe(true);
    expect(isSkillTrace("other", "sKiLl")).toBe(true);
  });

  it("should return true when name is prefixed with 'skill:' or 'generation:' for forbidden strings", () => {
    expect(isSkillTrace("skill:skill")).toBe(true);
    expect(isSkillTrace("generation:skill")).toBe(true);
    expect(isSkillTrace("skill:skill.md")).toBe(true);
    expect(isSkillTrace("generation:skill.md")).toBe(true);

    // Case insensitive checks
    expect(isSkillTrace("SKILL:skill.md")).toBe(true);
    expect(isSkillTrace("GENERATION:SKILL")).toBe(true);
  });

  it("should return false for normal trace names and skill names", () => {
    expect(isSkillTrace("skill:planning-expert")).toBe(false);
    expect(isSkillTrace("generation:test")).toBe(false);
    expect(isSkillTrace("my-custom-skill")).toBe(false);

    expect(isSkillTrace("skill:planning-expert", "planning-expert")).toBe(false);
    expect(isSkillTrace("generation:test", "test-skill")).toBe(false);
  });

  it("should return false for undefined inputs", () => {
    expect(isSkillTrace(undefined, undefined)).toBe(false);
    expect(isSkillTrace()).toBe(false);
  });

  it("should return false for empty strings", () => {
    expect(isSkillTrace("", "")).toBe(false);
    expect(isSkillTrace("")).toBe(false);
  });
});
