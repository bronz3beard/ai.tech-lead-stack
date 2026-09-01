import { Role } from '@prisma/client';
import { isSuperUser, getProjectAccessFilter } from '../access';

describe('Access Logic Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isSuperUser', () => {
    it('should return true for a whitelisted email in env', () => {
      process.env.SUPER_ADMIN = 'admin1@example.com, admin2@example.com';
      expect(isSuperUser('admin1@example.com')).toBe(true);
      expect(isSuperUser('ADMIN2@example.com')).toBe(true); // check case insensitivity
    });

    it('should return false for a non-whitelisted email', () => {
      process.env.SUPER_ADMIN = 'admin1@example.com';
      expect(isSuperUser('not.whitelisted@example.com')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isSuperUser(null)).toBe(false);
      expect(isSuperUser(undefined)).toBe(false);
    });
  });

  describe('getProjectAccessFilter', () => {
    it('should return an empty object for a super user', () => {
      process.env.SUPER_ADMIN = 'super@example.com';
      const superUser = {
        id: 'user-1',
        role: Role.DEVELOPER,
        email: 'super@example.com',
      };

      expect(getProjectAccessFilter(superUser)).toEqual({});
    });

    it('should return an empty object for an ADMIN role', () => {
      const adminUser = {
        id: 'user-2',
        role: Role.ADMIN,
        email: 'some.admin@example.com',
      };

      expect(getProjectAccessFilter(adminUser)).toEqual({});
    });

    it('should return correct Prisma filter for regular users (e.g., DEVELOPER)', () => {
      const regularUser = {
        id: 'user-3',
        role: Role.DEVELOPER,
        email: 'dev@example.com',
      };

      const filter = getProjectAccessFilter(regularUser);

      expect(filter).toEqual({
        OR: [
          { ownerId: regularUser.id },
          {
            accessGrants: {
              some: {
                userId: regularUser.id,
              },
            },
          },
        ],
      });
    });

    it('should return correct Prisma filter for other roles (e.g., PM)', () => {
      const pmUser = {
        id: 'user-4',
        role: Role.PM,
        email: 'pm@example.com',
      };

      const filter = getProjectAccessFilter(pmUser);

      expect(filter).toEqual({
        OR: [
          { ownerId: pmUser.id },
          {
            accessGrants: {
              some: {
                userId: pmUser.id,
              },
            },
          },
        ],
      });
    });
  });
});
