import { cn } from "../utils";

describe("cn", () => {
  it("should merge basic class names", () => {
    expect(cn("class-a", "class-b")).toBe("class-a class-b");
  });

  it("should merge tailwind classes and override correctly", () => {
    // twMerge behavior: p-4 should override p-2
    expect(cn("p-2", "p-4")).toBe("p-4");
    // px-4 should override px-2
    expect(cn("px-2", "px-4")).toBe("px-4");
    // text-red-500 should override text-blue-500
    expect(cn("text-blue-500", "text-red-500")).toBe("text-red-500");
  });

  it("should handle conditional classes using objects", () => {
    expect(
      cn("base-class", {
        "is-active": true,
        "is-inactive": false,
      })
    ).toBe("base-class is-active");
  });

  it("should ignore falsy values", () => {
    expect(
      cn(
        "class-a",
        null,
        undefined,
        false,
        0,
        "",
        "class-b"
      )
    ).toBe("class-a class-b");
  });

  it("should handle arrays of class names", () => {
    expect(cn(["class-a", "class-b"])).toBe("class-a class-b");
  });

  it("should handle mixed and nested inputs correctly", () => {
    expect(
      cn(
        "class-a",
        ["class-b", { "class-c": true, "class-d": false }],
        "class-e"
      )
    ).toBe("class-a class-b class-c class-e");
  });
});
