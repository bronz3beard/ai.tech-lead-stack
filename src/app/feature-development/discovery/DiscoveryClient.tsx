'use client';

import { DiscoverySetupModal } from '@/components/feature-development/DiscoverySetupModal';
import { FeatureDevelopmentModal } from '@/components/feature-development/FeatureDevelopmentModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode,
  Folder,
  HelpCircle,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Terminal as TerminalIcon,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

import { FileTree } from './components/FileTree';
import { TerminalLogs } from './components/TerminalLogs';
import { useDiscoveryChat } from './hooks/useDiscoveryChat';
import { useE2BSandbox } from './hooks/useE2BSandbox';
import { Project } from './types';
import { buildTree } from './utils/tree-helpers';

export default function DiscoveryClient({
  projects,
  defaultCreatorModel,
}: {
  projects: Project[];
  defaultCreatorModel: string;
}) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Discovery Context State
  const [componentName, setComponentName] = useState<string | undefined>();
  const [figmaUrl, setFigmaUrl] = useState<string | undefined>();
  const [branchUrl, setBranchUrl] = useState<string | undefined>();

  // Modal & Global UI State
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Cloud Generation Trigger States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);

  // Modular Hooks
  const {
    isSandboxReady,
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
    handleWriteFile,
    hydrateProject,
    setFileContent,
    setWrittenFiles,
    kill,
  } = useE2BSandbox();

  const {
    messages,
    input,
    isLoading,
    scrollRef,
    handleInputChange,
    handleSubmit,
  } = useDiscoveryChat({
    selectedProjectId,
    figmaUrl,
    branchUrl,
    componentName,
    handleWriteFile,
    selectedFile,
    setFileContent,
    setWrittenFiles,
    setSandboxError,
  });

  const fileTree = useMemo(() => buildTree(writtenFiles), [writtenFiles]);
  const hasStarted = messages.length > 0;

  // Sandbox Lifecycle & Teardown
  useEffect(() => {
    return () => {
      kill(); // Ensures sandbox is destroyed on unmount to prevent runaway costs
    };
  }, [kill]);

  // Sync hydration when a project is selected
  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId && !isSetupOpen) {
      await hydrateProject(projectId);
    }
  };

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

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Discovery Chat (Floating in Fullscreen) */}
        <section
          className={`bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 transition-all duration-500 ease-in-out flex flex-col z-40 ${
            isFullscreen
              ? isChatMinimized
                ? 'w-0 opacity-0 pointer-events-none'
                : 'fixed top-12 right-6 bottom-12 w-[400px] rounded-3xl shadow-2xl border-slate-700/50 bg-slate-900/90'
              : 'w-[400px]'
          }`}
        >
          {isFullscreen && !isChatMinimized && (
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Discovery Agent
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-white"
                onClick={() => setIsChatMinimized(true)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          )}
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
                onChange={(e) => handleProjectSelect(e.target.value)}
                disabled={hasStarted || isHydrating}
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
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={
                  selectedProjectId
                    ? isHydrating
                      ? 'Hydrating sandbox...'
                      : 'Type a message...'
                    : 'Select target first'
                }
                disabled={!selectedProjectId || isLoading || isHydrating}
                className="bg-slate-950/50 border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  !selectedProjectId ||
                  !input.trim() ||
                  isLoading ||
                  isHydrating
                }
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shrink-0 transition-all active:scale-90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </section>

        {/* Remote Sandbox Preview */ }
        <section className="flex-1 bg-slate-950 p-6 relative flex flex-col gap-4 overflow-hidden">
          {/* Controls Bar */}
          <div className="flex items-center justify-between shrink-0 px-1">
            <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800 shadow-lg">
              <Button
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className={
                  viewMode === 'preview'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'code' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('code')}
                className={
                  viewMode === 'code'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <FileCode className="w-4 h-4 mr-2" />
                Code Review
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTerminal(!showTerminal)}
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                  showTerminal
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5 mr-2" />
                Terminal {showTerminal ? 'On' : 'Off'}
              </Button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-slate-500 hover:text-white transition-all"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              {isSandboxReady && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                    Node v22 Active
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex gap-4 overflow-hidden relative">
            {/* Sidebar: File Tree */}
            <Card
              className={`shrink-0 flex flex-col overflow-hidden border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl transition-all duration-300 ${
                showSidebar
                  ? 'w-64 opacity-100'
                  : 'w-0 opacity-0 -ml-4 pointer-events-none'
              }`}
            >
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Filesystem
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-600">
                    {writtenFiles.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-slate-600 hover:text-slate-400"
                    onClick={() => setShowSidebar(false)}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {writtenFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center opacity-40">
                    <Loader2 className="w-5 h-5 mb-2 animate-spin" />
                    <span className="text-[9px] uppercase tracking-tighter">
                      Waiting for sync...
                    </span>
                  </div>
                ) : (
                  <FileTree
                    fileTree={fileTree}
                    selectedFile={selectedFile}
                    onSelectFile={(path) => {
                      setSelectedFile(path);
                      setViewMode('code');
                    }}
                  />
                )}
              </div>
            </Card>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 -left-2 z-50 h-10 w-4 bg-slate-900 border border-slate-800 rounded-r-lg hover:bg-slate-800 transition-all shadow-xl"
                  onClick={() => setShowSidebar(true)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
              <Card className="flex-1 flex flex-col overflow-hidden shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-sm group relative">
                <div className="flex-1 flex flex-col bg-slate-950/50 relative overflow-hidden">
                  {/* Error Banner */}
                  {sandboxError && (
                    <div className="absolute top-0 inset-x-0 z-50 bg-red-500/10 border-b border-red-500/50 backdrop-blur-md p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-500">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium border-none">
                          {sandboxError}
                        </span>
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

                  {isHydrating ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-10">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-emerald-500 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-t-2 border-l-2 border-slate-800 animate-spin-reverse" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-slate-200">
                          Hydrating Project Context
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          {hydrationStatus}
                        </p>
                      </div>
                    </div>
                  ) : !isSandboxReady ? (
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
                          Initializing Sandbox API...
                        </p>
                      </div>
                    </div>
                  ) : viewMode === 'preview' ? (
                    previewUrl ? (
                      <div className="w-full h-full bg-white">
                        <iframe
                          src={previewUrl}
                          className="w-full h-full border-none"
                          title="Live Prototyping Preview"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center z-10">
                        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6 shadow-2xl shadow-blue-500/5">
                          {writtenFiles.length > 0 ? (
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                          ) : (
                            <Eye className="w-10 h-10 text-blue-500" />
                          )}
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {writtenFiles.length > 0
                            ? 'Building Preview...'
                            : 'Awaiting Prototype'}
                        </h3>
                        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                          {writtenFiles.length > 0
                            ? 'The dev server is starting. Review the file tree or code while it initializes.'
                            : 'Select a project to get started, and then you will be able to start a conversation to generate visual requirements and interactive prototypes.'}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full overflow-auto custom-scrollbar bg-[#1e1e1e]">
                      {selectedFile ? (
                        <SyntaxHighlighter
                          language={
                            selectedFile.split('.').pop() === 'tsx'
                              ? 'typescript'
                              : selectedFile.split('.').pop() || 'typescript'
                          }
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1.5rem',
                            background: 'transparent',
                            fontSize: '13px',
                            lineHeight: '1.6',
                          }}
                          showLineNumbers
                        >
                          {fileContent || '// Loading file content...'}
                        </SyntaxHighlighter>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 p-12 text-center">
                          <FileCode className="w-16 h-16 mb-4 opacity-10" />
                          <h4 className="text-sm font-medium text-slate-400">
                            Select a file to review
                          </h4>
                          <p className="text-xs max-w-[200px] mt-2 leading-relaxed">
                            Click any file in the sidebar to review the code
                            generated by the Discovery Agent.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Terminal */}
                {showTerminal && (
                  <TerminalLogs
                    terminalOutput={terminalOutput}
                    onClose={() => setShowTerminal(false)}
                  />
                )}
              </Card>
            </div>
          </div>
        </section>
        {isFullscreen && isChatMinimized && (
          <Button
            onClick={() => setIsChatMinimized(false)}
            className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/40 animate-in fade-in zoom-in duration-300"
          >
            <MessageSquare className="w-5 h-5 text-white" />
          </Button>
        )}
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>

      <DiscoverySetupModal
        isOpen={isSetupOpen}
        onComplete={async (data) => {
          setIsSetupOpen(false);
          setComponentName(data.componentName);
          setFigmaUrl(data.figmaUrl);
          setBranchUrl(data.branchUrl);

          if (!selectedProjectId) return;
          await hydrateProject(selectedProjectId);
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
