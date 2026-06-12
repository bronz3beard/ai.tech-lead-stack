import { FileNode } from '../types';

export interface ISandboxService {
  /** Current state of the sandbox */
  status: 'idle' | 'booting' | 'running' | 'error';
  
  /** 
   * The public URL where the dev server is exposed.
   * Will be null until the dev server is fully running.
   */
  serverUrl: string | null;

  /** Error message if the sandbox failed to boot or run */
  error: string | null;

  /**
   * Initializes the sandbox and prepares the environment.
   */
  boot: (files: Record<string, string>) => Promise<void>;

  /**
   * Restarts the dev server process within the sandbox if needed.
   */
  restartDevServer: () => Promise<void>;

  /**
   * Terminates the sandbox to prevent runaway costs.
   */
  kill: () => Promise<void>;

  /**
   * Writes a file to the sandbox filesystem.
   */
  writeFile: (path: string, content: string) => Promise<void>;

  /**
   * Reads a file from the sandbox filesystem.
   */
  readFile: (path: string) => Promise<string>;

  /**
   * Lists the directory structure of the sandbox filesystem.
   */
  listDir: (path?: string) => Promise<FileNode[]>;
}
