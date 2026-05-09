import { Role } from '@prisma/client';
import { isSuperUser, getProjectAccessFilter } from '../access';

describe('Access Logic Tests', () => {
  describe('isSuperUser', () => {
    it('should return true for a whitelisted email', () => {
      // Create a test mimicking the actual array to avoid conditional tests
      const whitelistedEmail = 'info2rory@gmail.com';
      expect(isSuperUser(whitelistedEmail)).toBe(true);
    });

    it('should return false for a non-whitelisted email', () => {
      expect(isSuperUser('not.whitelisted@example.com')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isSuperUser(null)).toBe(false);
      expect(isSuperUser(undefined)).toBe(false);
    });
  });

  describe('getProjectAccessFilter', () => {
    it('should return an empty object for a super user', () => {
      const superUser = {
        id: 'user-1',
        role: Role.DEVELOPER,
        email: 'info2rory@gmail.com', // Match the exported list for deterministic execution
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
                role: regularUser.role,
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
                role: pmUser.role,
              },
            },
          },
        ],
      });
    });
  });
});
