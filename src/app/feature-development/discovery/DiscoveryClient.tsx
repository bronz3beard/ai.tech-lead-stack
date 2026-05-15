'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { WebContainer } from '@webcontainer/api';
import { DefaultChatTransport } from 'ai';
import { ArrowLeft, Folder, Loader2, Send, Terminal as TerminalIcon, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Project {
  id: string;
  name: string;
  githubFullName?: string | null;
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
  const [hasFiles, setHasFiles] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDevServerStarted, setIsDevServerStarted] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WebContainer Initialization
  useEffect(() => {
    async function boot() {
      try {
        console.log('Booting WebContainer...');
        const instance = await WebContainer.boot();
        setWebContainer(instance);
        setIsSandboxReady(true);
        console.log('WebContainer ready.');
      } catch (err) {
        console.error('WebContainer boot failed:', err);
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
        },
      }),
    [selectedProjectId]
  );

  // Helper to start dev server
  const startDevServer = async (instance: WebContainer) => {
    if (isDevServerStarted) return;
    setIsDevServerStarted(true);
    setTerminalOutput(prev => [...prev, '$ npm install && npm run dev']);
    
    try {
      // Mocking a package.json if it doesn't exist to ensure dev server can start
      try {
        await instance.fs.readFile('package.json');
      } catch {
        await instance.fs.writeFile('package.json', JSON.stringify({
          name: 'prototype',
          type: 'module',
          dependencies: {
            'react': '^19.0.0',
            'react-dom': '^19.0.0',
            'lucide-react': 'latest'
          },
          scripts: {
            'dev': 'next dev -p 3000'
          }
        }, null, 2));
      }

      const installProcess = await instance.spawn('npm', ['install']);
      installProcess.output.pipeTo(new WritableStream({
        write(data) { setTerminalOutput(prev => [...prev, data]); }
      }));
      await installProcess.exit;

      const devProcess = await instance.spawn('npm', ['run', 'dev']);
      devProcess.output.pipeTo(new WritableStream({
        write(data) { setTerminalOutput(prev => [...prev, data]); }
      }));

      instance.on('server-ready', (port, url) => {
        if (port === 3000) setPreviewUrl(url);
      });
    } catch (err) {
      console.error('Dev server failed:', err);
      setIsDevServerStarted(false);
    }
  };

  // Streaming AI Chat
  const { messages, status, sendMessage } = useChat({
    transport,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'write_to_sandbox') {
        const { path, content } = (toolCall as any).args as { path: string; content: string };
        if (webContainer) {
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
          setHasFiles(true);
          startDevServer(webContainer);
        }
      }
    },
    onFinish: () => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

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
        </div>
        <div className="flex items-center space-x-3">
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
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                    Node.js Active
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center bg-slate-950 relative overflow-hidden">
              {/* Decorative grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#fff 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />

              {!isSandboxReady ? (
                <div className="flex flex-col items-center space-y-6 z-10">
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
                  <div className="h-32 bg-slate-950 border-t border-slate-800 font-mono text-[10px] p-3 overflow-y-auto text-slate-400">
                    <div className="flex items-center space-x-2 text-slate-500 mb-1">
                      <TerminalIcon className="w-3 h-3" />
                      <span className="uppercase tracking-widest font-bold">Live Output</span>
                    </div>
                    {terminalOutput.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-md text-center space-y-6 z-10 px-8">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    {hasFiles ? (
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    ) : (
                      <Eye className="w-10 h-10 text-blue-500" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-white">
                      {hasFiles ? 'Generating Visual Prototype…' : 'Development Sandbox Ready'}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {hasFiles 
                        ? 'The agent is writing prototype files. The preview will update automatically once the dev server starts.'
                        : 'Your ephemeral development environment is active. As requirements are refined, the agent will provide live visual mockups here.'}
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
    </div>
  );
}
