import { FileSystemService } from "./fs-service.js";
import { findRepoRoot } from "./repo-root.js";

const repoRoot = findRepoRoot();

/**
 * Shared instance of FileSystemService for use throughout the application.
 */
export const skillsService = new FileSystemService(repoRoot);

export * from "./fs-service.js";
export * from "./repo-root.js";

