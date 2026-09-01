import { Role } from '@prisma/client';

/**
 * Checks if a user email is in the superuser whitelist defined in the SUPER_ADMIN env variable.
 */
export function isSuperUser(email?: string | null): boolean {
  if (!email) return false;
  
  const superAdminEnv = process.env.SUPER_ADMIN || '';
  const whitelistedEmails = superAdminEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
    
  return whitelistedEmails.includes(email.trim().toLowerCase());
}

/**
 * Returns a Prisma 'where' clause for filtering projects based on user access.
 * 
 * Logic:
 * - Superusers see everything.
 * - ADMIN role sees everything (optional, but usually desired).
 * - Others see:
 *   - Projects they own.
 *   - Projects where they have an explicit user-based access grant.
 */
export function getProjectAccessFilter(user: { id: string; role: string; email?: string | null }) {
  if (isSuperUser(user.email) || user.role === Role.ADMIN) {
    return {};
  }

  return {
    OR: [
      { ownerId: user.id },
      {
        accessGrants: {
          some: {
            userId: user.id,
          },
        },
      },
    ],
  };
}
