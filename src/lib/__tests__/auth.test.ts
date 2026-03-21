import { authOptions } from "../auth";

jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
      },
    })),
  };
});

jest.mock("@next-auth/prisma-adapter", () => ({
  PrismaAdapter: jest.fn(),
}));

describe("authOptions", () => {
  it("should have GithubProvider configured", () => {
    expect(authOptions.providers.length).toBe(1);
    expect(authOptions.providers[0].id).toBe("github");
  });

  it("should have jwt strategy configured", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });
});
