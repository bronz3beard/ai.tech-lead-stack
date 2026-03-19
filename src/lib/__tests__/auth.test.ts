import { authOptions } from "../../../src/app/api/auth/[...nextauth]/route";

jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
      },
    })),
  };
});

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

describe("authOptions", () => {
  it("should have CredentialsProvider configured", () => {
    expect(authOptions.providers.length).toBe(1);
    expect(authOptions.providers[0].name).toBe("Credentials");
  });

  it("should have jwt strategy configured", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });
});
