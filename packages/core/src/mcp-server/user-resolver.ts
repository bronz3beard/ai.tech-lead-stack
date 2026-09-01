import { execSync } from "child_process";

/**
 * UserResolver extracts identity information from the environment.
 * Enforces SRP by isolating identity resolution from telemetry orchestration.
 */
export class UserResolver {
  /**
   * Strictly gets user email from GitHub CLI for dashboard parity, with fallbacks to git config.
   */
  getUserEmail(): string {
    let userEmail = 'unknown';
    try {
      // Primary: GitHub CLI (best for parity with GitHub OAuth)
      userEmail = execSync('gh api user -q .email', { stdio: 'pipe' })
        .toString()
        .trim();

      // If GH CLI returns nothing or empty, fallback to git config
      if (!userEmail || userEmail === 'null') {
         userEmail = execSync('git config --global user.email', { stdio: 'pipe' })
           .toString()
           .trim();
      }
    } catch {
      try {
        // Fallback: Git Config
        userEmail = execSync('git config --global user.email', { stdio: 'pipe' })
          .toString()
          .trim();
      } catch {
        // Fallback: Env variable
        userEmail = process.env.USER_EMAIL || 'unknown';
      }
    }
    return userEmail;
  }

  /**
   * Retrieves user name from git configuration.
   */
  getUserName(): string {
    try {
      return execSync('git config --global user.name', { stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      return 'unknown';
    }
  }
}
