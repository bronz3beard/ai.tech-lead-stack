import { useState, useRef, useCallback, useEffect } from 'react';
import {
  writeSandboxFileAction,
  readSandboxFileAction,
  killSandboxAction,
} from '../actions/e2b';
import { ISandboxService } from '../types/sandbox';
import { flattenTree } from '../utils/tree-helpers';

export function useE2BSandbox() {
  const [status, setStatus] = useState<ISandboxService['status']>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [hydrationStatus, setHydrationStatus] = useState('');
  const [isHydrating, setIsHydrating] = useState(false);
  
  // UI State matching previous sandbox logic
  const [writtenFiles, setWrittenFiles] = useState<{ path: string; status: 'writing' | 'done' | 'error' }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const [sandboxId, setSandboxId] = useState<string | null>(null);

  const writeToTerminal = useCallback((data: string) => {
    setTerminalOutput(prev => [...prev, data]);
  }, []);

  const isSandboxReady = status === 'running';

  useEffect(() => {
    async function readFileContent() {
      if (selectedFile && sandboxId) {
        try {
          const res = await readSandboxFileAction(sandboxId, selectedFile);
          if (res.success) {
            setFileContent(res.content!);
          } else {
            throw new Error(res.error);
          }
        } catch (err) {
          console.error('Failed to read file:', selectedFile, err);
          setFileContent('// Failed to load file content.');
        }
      }
    }
    readFileContent();
  }, [selectedFile, sandboxId]);

  const boot = async (files: Record<string, string>) => {
    if (sandboxId) return;
    setStatus('booting');
    setIsHydrating(true);
    setSandboxError(null);
    setTerminalOutput([]);

    try {
      const res = await fetch('/api/orchestrator/sandbox/boot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filesRecord: files }),
      });

      if (!res.ok) {
        throw new Error('Failed to start boot stream');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream returned');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; payload: unknown };
          try {
            event = JSON.parse(line);
          } catch {
            console.warn('Failed to parse stream line as JSON:', line);
            continue;
          }

          if (event.type === 'status') {
            setHydrationStatus(event.payload as string);
          } else if (event.type === 'log') {
            writeToTerminal(event.payload as string);
          } else if (event.type === 'ready') {
            const payload = event.payload as { sandboxId: string; url: string };
            setSandboxId(payload.sandboxId);
            setPreviewUrl(payload.url);
            setStatus('running');
            setHydrationStatus('Environment ready');
          } else if (event.type === 'error') {
            throw new Error(event.payload as string);
          }
        }
      }
    } catch (e: any) {
      console.error('[E2B Sandbox Error]', e);
      setSandboxError(e.message || 'Failed to boot E2B sandbox');
      setStatus('error');
    } finally {
      setIsHydrating(false);
    }
  };

  const kill = async () => {
    if (sandboxId) {
      await killSandboxAction(sandboxId);
      setSandboxId(null);
      setStatus('idle');
      setPreviewUrl(null);
      setTerminalOutput([]);
    }
  };

  const handleWriteFile = async (path: string, content: string) => {
    if (!sandboxId) return;

    setWrittenFiles((prev) => {
      const exists = prev.find((f) => f.path === path);
      if (exists) return prev.map((f) => f.path === path ? { ...f, status: 'writing' } : f);
      return [...prev, { path, status: 'writing' }];
    });

    try {
      const res = await writeSandboxFileAction(sandboxId, path, content);
      
      if (!res.success) {
        throw new Error(res.error);
      }

      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'done' } : f))
      );
    } catch (err) {
      console.error('Failed to write file:', path, err);
      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'error' } : f))
      );
      setSandboxError(`Failed to write file: ${path}`);
    }
  };

  const hydrateProject = async (projectId: string) => {
    if (!projectId) return;

    setIsHydrating(true);
    setHydrationStatus('Fetching project bundle...');
    try {
      const res = await fetch(`/api/orchestrator/discovery/project-bundle?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const { bundle } = await res.json();

      const flatFiles = flattenTree(bundle);
      setWrittenFiles(flatFiles);

      // Convert project bundle format to flat Record<string, string>
      const filesRecord: Record<string, string> = {};
      
      // Helper to recursively parse the bundle
      const parseBundle = (node: any, currentPath: string = '') => {
        for (const [name, entry] of Object.entries(node)) {
          const itemPath = currentPath ? `${currentPath}/${name}` : name;
          const anyEntry = entry as any;
          if (anyEntry.file && anyEntry.file.contents) {
            // Some bundle files are Uint8Arrays, E2B write takes string, Uint8Array
            let contents = anyEntry.file.contents;
            if (typeof contents !== 'string') {
               // naive string conversion for code files
               contents = new TextDecoder().decode(contents);
            }
            filesRecord[itemPath] = contents;
          } else if (anyEntry.directory) {
            parseBundle(anyEntry.directory, itemPath);
          }
        }
      };
      
      parseBundle(bundle);

      await boot(filesRecord);
    } catch (err: any) {
      console.error('Hydration failed:', err);
      setSandboxError('Hydration failed, falling back.');
    } finally {
      setIsHydrating(false);
      setHydrationStatus('');
    }
  };

  const syncFilesystem = async () => {
    // E2B sandbox doesn't need to sync the entire filesystem because the files
    // are already tracked in `writtenFiles` via `hydrateProject` and `handleWriteFile`.
    // We could implement a deep scan if necessary, but this satisfies the API.
  };

  return {
    isSandboxReady,
    sandboxId,
    writtenFiles,
    previewUrl,
    terminalOutput,
    sandboxError,
    isHydrating,
    hydrationStatus,
    selectedFile,
    fileContent,
    viewMode,
    setSandboxError,
    setSelectedFile,
    setViewMode,
    setTerminalOutput,
    syncFilesystem,
    handleWriteFile,
    hydrateProject,
    setFileContent,
    setWrittenFiles,
    kill,
  };
}
