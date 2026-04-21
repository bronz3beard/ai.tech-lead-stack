import { Role } from '@prisma/client';

/**
 * List of emails that have full access to all projects regardless of role or ownership.
 */
export const WHITELISTED_EMAILS = ['info2rory@gmail.com'];

/**
 * Checks if a user email is in the superuser whitelist.
 */
export function isSuperUser(email?: string | null): boolean {
  if (!email) return false;
  return WHITELISTED_EMAILS.includes(email);
}

/**
 * Returns a Prisma 'where' clause for filtering projects based on user access.
 * 
 * Logic:
 * - Superusers see everything.
 * - ADMIN role sees everything (optional, but usually desired).
 * - Others see:
 *   - Projects they own.
 *   - Projects where they have an explicit access grant for their role.
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
            role: user.role as Role,
          },
        },
      },
    ],
  };
}
