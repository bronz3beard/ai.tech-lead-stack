import { FileSystemService } from "./fs-service";
import * as path from "path";

// Find repo root (one level up from src)
const repoRoot = path.resolve(/*turbopackIgnore: true*/ __dirname, "../../../");

/**
 * Shared instance of FileSystemService for use throughout the application.
 */
export const skillsService = new FileSystemService(repoRoot);

export * from "./fs-service";
