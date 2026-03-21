import { withAnalytics } from "../analytics";

// Mock Langfuse to prevent real network calls during tests
jest.mock("langfuse-node", () => {
  const mTrace = {
    update: jest.fn(),
    generation: jest.fn(),
  };
  return {
    Langfuse: jest.fn().mockImplementation(() => ({
      trace: jest.fn(() => mTrace),
      flushAsync: jest.fn(),
    })),
  };
});

describe("withAnalytics", () => {
  it("should wrap a successful skill execution", async () => {
    const mockSkill = jest.fn().mockResolvedValue("Success!");
    const wrappedSkill = await withAnalytics("test-skill", { userId: "user-123" }, mockSkill);

    const result = await wrappedSkill("test-input");
    expect(result).toBe("Success!");
    expect(mockSkill).toHaveBeenCalledWith("test-input");
  });

  it("should handle error in skill execution", async () => {
    const mockSkill = jest.fn().mockRejectedValue(new Error("Failed"));
    const wrappedSkill = await withAnalytics("test-skill", { userId: "user-123" }, mockSkill);

    await expect(wrappedSkill("test-input")).rejects.toThrow("Failed");
    expect(mockSkill).toHaveBeenCalledWith("test-input");
  });
});
