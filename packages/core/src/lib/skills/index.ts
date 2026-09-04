import { FileSystemService } from "./fs-service";
import { findRepoRoot } from "./repo-root";

const repoRoot = findRepoRoot();

/**
 * Shared instance of FileSystemService for use throughout the application.
 */
export const skillsService = new FileSystemService(repoRoot);

export * from "./fs-service";
export * from "./repo-root";

