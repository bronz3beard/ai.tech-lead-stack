'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { WebContainer } from '@webcontainer/api';
import { DefaultChatTransport } from 'ai';
import { ArrowLeft, Folder, Loader2, Send, Terminal as TerminalIcon, Eye, HelpCircle, Check, FileCode, AlertCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DiscoverySetupModal } from '@/components/feature-development/DiscoverySetupModal';
import { FeatureDevelopmentModal } from '@/components/feature-development/FeatureDevelopmentModal';

export interface Project {
  id: string;
  name: string;
  githubFullName?: string | null;
}

/**
 * Singleton promise to ensure WebContainer.boot() is only called once
 * throughout the application lifecycle.
 */
let webContainerInstancePromise: Promise<WebContainer> | null = null;

async function getWebContainerInstance() {
  if (typeof window === 'undefined') return null;
  if (!webContainerInstancePromise) {
    webContainerInstancePromise = WebContainer.boot();
  }
  return webContainerInstancePromise;
}

export default function DiscoveryClient({
  projects,
  defaultCreatorModel,
}: {
  projects: Project[];
  defaultCreatorModel: string;
}) {
  const router = useRouter();
  const [isSandboxReady, setIsSandboxReady] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<{ path: string; status: 'writing' | 'done' | 'error' }[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDevServerStarted, setIsDevServerStarted] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const devServerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Discovery Context State
  const [componentName, setComponentName] = useState<string | undefined>();
  const [figmaUrl, setFigmaUrl] = useState<string | undefined>();
  const [branchUrl, setBranchUrl] = useState<string | undefined>();
  
  // Modal State
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // WebContainer Initialization
  useEffect(() => {
    async function boot() {
      try {
        console.log('Booting WebContainer...');
        const instance = await getWebContainerInstance();
        if (instance) {
          setWebContainer(instance);
          setIsSandboxReady(true);
          console.log('WebContainer ready.');
        }
      } catch (err) {
        console.error('WebContainer boot failed:', err);
        setSandboxError('Failed to initialize development environment.');
      }
    }
    if (typeof window !== 'undefined' && !webContainer) {
      boot();
    }
  }, [webContainer]);

  const [input, setInput] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/orchestrator/discovery',
        body: {
          projectId: selectedProjectId,
          figmaUrl,
          branchUrl,
          componentName,
        },
      }),
    [selectedProjectId, figmaUrl, branchUrl, componentName]
  );

  // Helper to start dev server
  const startDevServer = async (instance: WebContainer) => {
    if (isDevServerStarted) return;
    setIsDevServerStarted(true);
    setTerminalOutput(prev => [...prev, '$ npm install && npm run dev']);
    
    try {
      // Ensure a basic package.json exists if the agent hasn't written one yet
      try {
        await instance.fs.readFile('package.json');
      } catch {
        await instance.fs.writeFile('package.json', JSON.stringify({
          name: 'prototype',
          type: 'module',
          dependencies: {
            'react': '^19.0.0',
            'react-dom': '^19.0.0',
            'lucide-react': 'latest',
            'next': 'latest'
          },
          scripts: {
            'dev': 'next dev -p 3000'
          }
        }, null, 2));
      }

      const installProcess = await instance.spawn('pnpm', ['install']);
      installProcess.output.pipeTo(new WritableStream({
        write(data) { setTerminalOutput(prev => [...prev, data]); }
      }));
      await installProcess.exit;

      const devProcess = await instance.spawn('pnpm', ['run', 'dev']);
      devProcess.output.pipeTo(new WritableStream({
        write(data) { setTerminalOutput(prev => [...prev, data]); }
      }));

      instance.on('server-ready', (port, url) => {
        if (port === 3000) setPreviewUrl(url);
      });
    } catch (err) {
      console.error('Dev server failed:', err);
      setIsDevServerStarted(false);
      setSandboxError('Dev server failed to start. See console for details.');
    }
  };

  const handleWriteFile = async (path: string, content: string) => {
    if (!webContainer) return;
    
    setWrittenFiles(prev => {
      const exists = prev.find(f => f.path === path);
      if (exists) return prev.map(f => f.path === path ? { ...f, status: 'writing' } : f);
      return [...prev, { path, status: 'writing' }];
    });

    try {
      // Ensure directory exists
      const parts = path.split('/');
      if (parts.length > 1) {
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current += (current ? '/' : '') + parts[i];
          try {
            await webContainer.fs.mkdir(current, { recursive: true });
          } catch (e) {}
        }
      }
      await webContainer.fs.writeFile(path, content);
      
      setWrittenFiles(prev => prev.map(f => f.path === path ? { ...f, status: 'done' } : f));

      // Reset dev server timeout
      if (devServerTimeoutRef.current) clearTimeout(devServerTimeoutRef.current);
      devServerTimeoutRef.current = setTimeout(() => {
        startDevServer(webContainer);
      }, 2500);

    } catch (err) {
      console.error('Failed to write file:', path, err);
      setWrittenFiles(prev => prev.map(f => f.path === path ? { ...f, status: 'error' } : f));
      setSandboxError(`Failed to write file: ${path}`);
    }
  };

  // Streaming AI Chat
  const { messages, status, sendMessage } = useChat({
    transport,
    onError: (err) => {
      console.error('Chat error:', err);
      setSandboxError(`Stream error: ${err.message}`);
    },
    onFinish: () => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  // Watch messages for toolInvocations (Fix for Bug 1: onToolCall is bypassed for server-executed tools)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1] as any;
    if (lastMessage?.toolInvocations) {
      lastMessage.toolInvocations.forEach((invocation: any) => {
        if (invocation.toolName === 'write_to_sandbox' && invocation.state === 'result') {
          // File was already written and result is in the stream
          // We sync our local state if it's not already there
          const { path } = invocation.args as { path: string };
          setWrittenFiles(prev => {
            if (prev.find(f => f.path === path && f.status === 'done')) return prev;
            const exists = prev.find(f => f.path === path);
            if (exists) return prev.map(f => f.path === path ? { ...f, status: 'done' } : f);
            return [...prev, { path, status: 'done' }];
          });
        } else if (invocation.toolName === 'write_to_sandbox' && invocation.state === 'call') {
          // This fires when the tool call is emitted but not yet finished on server
          // In SDK v6 with providerExecuted: true, we can't reliably catch the call delta here 
          // without experimental_onToolCallStart, but the server execution will finish it.
          // However, since we WANT to write on client for immediate WebContainer updates:
          const { path, content } = invocation.args as { path: string; content: string };
          if (path && content) {
             handleWriteFile(path, content);
          }
        }
      });
    }
  }, [messages, webContainer]);

  const isLoading = status === 'streaming';

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage(
      { parts: [{ type: 'text', text: input }] },
      { body: { projectId: selectedProjectId } }
    );
    setInput('');
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);

  const handleStartGeneration = async () => {
    if (!selectedProjectId || messages.length === 0) return;

    setIsGenerating(true);
    try {
      const lastMessage = messages[messages.length - 1];
      const lastPrompt =
        lastMessage.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => (p as any).text)
          .join('\n') ||
        (lastMessage as any).content ||
        '';
      const branchName = `discovery/feature-requirements-${Date.now()}`;

      const response = await fetch('/api/orchestrator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          prompt: lastPrompt,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger cloud runner');
      }

      setGenerationStarted(true);
      (window as any)._currentBranch = branchName;
      alert('Cloud Runner triggered! Branch: ' + branchName);
    } catch (err: any) {
      console.error('Error starting generation:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishDiscovery = async () => {
    const branchName =
      (window as any)._currentBranch ||
      `discovery/feature-requirements-${Date.now()}`;
    try {
      const response = await fetch('/api/orchestrator/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          creatorModelUsed: defaultCreatorModel,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger audit');
      }

      router.push('/feature-development/in-progress');
    } catch (err: any) {
      console.error('Error finishing discovery:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-950 text-slate-50 dark overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-6 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          <h1 className="text-sm font-semibold text-white tracking-tight uppercase">
            Feature Discovery
          </h1>
          {componentName && (
            <>
              <div className="h-4 w-px bg-slate-800 mx-2" />
              <span className="text-xs font-medium text-slate-400">
                {componentName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsGuideOpen(true)}
            className="text-slate-400 hover:text-white"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Guide
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          {!generationStarted ? (
            <Button
              onClick={handleStartGeneration}
              disabled={!hasStarted || !selectedProjectId || isGenerating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isGenerating ? 'Triggering Runner...' : 'Start Generation'}
            </Button>
          ) : (
            <Button
              onClick={handleFinishDiscovery}
              variant="default"
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              Trigger Audit Phase
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Chat Interface */}
        <section className="flex w-[400px] flex-col border-r border-slate-800 bg-slate-900/30 backdrop-blur-md">
          {/* Project Selector */}
          <div className="p-5 border-b border-slate-800/50">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block">
              Deployment Target
            </label>
            <div className="relative group">
              <Folder className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <select
                id="project-select"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg py-2.5 pl-10 pr-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all appearance-none disabled:opacity-50"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={hasStarted}
              >
                <option value="" disabled>
                  Select a repository…
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
            {!selectedProjectId ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select a project repository above to begin the requirements
                  discovery process.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Describe the feature you want to build. Our Discovery Agent
                  will help you refine the technical specifications.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    {msg.role === 'user' ? 'User' : 'Discovery Agent'}
                  </span>
                  <div
                    className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed chat-prose ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.parts
                        ?.filter((p: any) => p.type === 'text')
                        .map((p: any) => (p as any).text)
                        .join('\n') || (msg as any).content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex flex-col space-y-2 items-start animate-pulse">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                  Discovery Agent
                </span>
                <div className="bg-slate-800 h-10 w-24 rounded-2xl rounded-tl-none border border-slate-700/50" />
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-5 border-t border-slate-800/50 bg-slate-900/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="flex space-x-2"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={
                  selectedProjectId
                    ? 'Type a message...'
                    : 'Select target first'
                }
                disabled={!selectedProjectId || isLoading}
                className="bg-slate-950/50 border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!selectedProjectId || !input.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shrink-0 transition-all active:scale-90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </section>

        {/* WebContainer Sandbox Preview */}
        <section className="flex-1 bg-slate-950 p-6 relative">
          <Card className="w-full h-full flex flex-col overflow-hidden shadow-2xl border-slate-800 bg-slate-900 group">
            <div className="h-12 border-b border-slate-800 flex shrink-0 items-center justify-between px-5 bg-slate-950/50">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Terminal Preview (Sandbox)
                </div>
              </div>
              {isSandboxReady && (
                <div className="flex items-center space-x-2">
                  {isLoading && (
                    <div className="flex items-center space-x-2 mr-2 border-r border-slate-800 pr-3">
                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                        Agent Writing...
                      </span>
                    </div>
                  )}
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                    Node.js Active
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
              {/* Error Banner */}
              {sandboxError && (
                <div className="absolute top-0 inset-x-0 z-50 bg-red-500/10 border-b border-red-500/50 backdrop-blur-md p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">{sandboxError}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-red-500 hover:bg-red-500/20"
                    onClick={() => setSandboxError(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Decorative grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />

              {!isSandboxReady ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-10">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-t-2 border-l-2 border-slate-800 animate-spin-reverse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-slate-200">
                      Booting Sandbox
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                      Initializing WebContainer API...
                    </p>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 bg-white relative">
                    <iframe 
                      src={previewUrl} 
                      className="w-full h-full border-none"
                      title="Live Prototyping Preview"
                    />
                  </div>
                  <div className="h-48 bg-slate-950 border-t border-slate-800 font-mono text-[10px] p-3 overflow-y-auto text-slate-400">
                    <div className="flex items-center justify-between text-slate-500 mb-2 border-b border-slate-800/50 pb-1">
                      <div className="flex items-center space-x-2">
                        <TerminalIcon className="w-3 h-3" />
                        <span className="uppercase tracking-widest font-bold">Live Output</span>
                      </div>
                      <div className="flex items-center space-x-2">
                         <span className="text-[9px] text-emerald-500 font-bold">● ONLINE</span>
                      </div>
                    </div>
                    {terminalOutput.map((line, i) => (
                      <div key={i} className="mb-0.5">{line}</div>
                    ))}
                  </div>
                </div>
              ) : writtenFiles.length > 0 ? (
                <div className="flex-1 flex flex-col overflow-hidden z-10">
                   <div className="p-6 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/50">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Constructing Application</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Live Sandbox Sync Active</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-slate-500 uppercase">Status</div>
                          <div className="text-xs font-mono text-blue-400">Installing...</div>
                        </div>
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono">
                      {writtenFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/30 group hover:border-blue-500/30 transition-all">
                          <div className="flex items-center space-x-3">
                            {file.status === 'writing' ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : file.status === 'error' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <FileCode className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs text-slate-300">{file.path}</span>
                          </div>
                          <span className={`text-[9px] uppercase font-bold ${
                            file.status === 'writing' ? 'text-blue-500' : 
                            file.status === 'error' ? 'text-red-500' : 'text-slate-600'
                          }`}>
                            {file.status}
                          </span>
                        </div>
                      ))}
                   </div>
                </div>
              ) : (
                <div className="max-w-md text-center space-y-6 z-10 px-8">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Eye className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-white">
                      Development Sandbox Ready
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Your ephemeral development environment is active. As requirements are refined, the agent will provide live visual mockups here.
                    </p>
                  </div>
                  <div className="pt-4 flex items-center justify-center space-x-4">
                    <div className="flex flex-col items-center">
                      <div className="text-xs font-mono text-slate-500">
                        PORT
                      </div>
                      <div className="text-sm font-mono text-blue-400">
                        3000
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="flex flex-col items-center">
                      <div className="text-xs font-mono text-slate-500">
                        RUNTIME
                      </div>
                      <div className="text-sm font-mono text-blue-400">
                        Node v20
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>

      <style jsx global>{`
        @keyframes spin-reverse {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
        .animate-spin-reverse {
          animation: spin-reverse 1.5s linear infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <DiscoverySetupModal
        isOpen={isSetupOpen}
        onComplete={(data) => {
          setComponentName(data.componentName);
          setFigmaUrl(data.figmaUrl);
          setBranchUrl(data.branchUrl);
          setIsSetupOpen(false);
        }}
      />

      <FeatureDevelopmentModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        figmaUrl={figmaUrl}
      />
    </div>
  );
}
