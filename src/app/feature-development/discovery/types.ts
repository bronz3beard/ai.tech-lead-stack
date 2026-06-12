export interface WriteToSandboxArgs {
  path: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  githubFullName?: string | null;
}

export interface FileNode {
  name: string;
  path: string;
  children?: Array<FileNode>;
  isDirectory: boolean;
  status?: 'writing' | 'done' | 'error';
}
