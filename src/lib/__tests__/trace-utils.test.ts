import { isSkillTrace, isActiveSkill } from "../trace-utils";

describe("isSkillTrace", () => {
  it("should return true when name is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace("skill")).toBe(true);
    expect(isSkillTrace("skill.md")).toBe(true);
  });

  it("should return true when skillName is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace(undefined, "skill")).toBe(true);
    expect(isSkillTrace("other", "skill.md")).toBe(true);
  });

  it("should return false for normal trace names and skill names", () => {
    expect(isSkillTrace("skill:planning-expert")).toBe(false);
    expect(isSkillTrace("generation:test")).toBe(false);
    expect(isSkillTrace("my-custom-skill")).toBe(false);

    expect(isSkillTrace("skill:planning-expert", "planning-expert")).toBe(false);
    expect(isSkillTrace("generation:test", "test-skill")).toBe(false);
  });
});

describe("isActiveSkill", () => {
  it("should return true for any valid user-facing skill", () => {
    expect(isActiveSkill("planning-expert")).toBe(true);
    expect(isActiveSkill("agent-optimizer")).toBe(true);
    expect(isActiveSkill("some-random-new-skill")).toBe(true);
  });

  it("should return false for system/meta-skill traces", () => {
    expect(isActiveSkill("skill")).toBe(false);
    expect(isActiveSkill("skill.md")).toBe(false);
    expect(isActiveSkill("unknown")).toBe(false);
  });

  it("should handle case sensitivity and .md extensions", () => {
    expect(isActiveSkill("Planning-Expert.md")).toBe(true);
    expect(isActiveSkill("SKILL.MD")).toBe(false);
  });

  it("should return false for undefined or empty input", () => {
    expect(isActiveSkill(undefined)).toBe(false);
    expect(isActiveSkill("")).toBe(false);
  });
});
