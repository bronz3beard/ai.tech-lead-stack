import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TerminalLogsProps {
  terminalOutput: string[];
  onClose: () => void;
}

export function TerminalLogs({ terminalOutput, onClose }: TerminalLogsProps) {
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const [isTerminalAtBottom, setIsTerminalAtBottom] = useState(true);

  // Terminal Autoscroll Logic
  const handleTerminalScroll = () => {
    if (!terminalScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalScrollRef.current;
    // Buffer of 10px to account for rounding/precision
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setIsTerminalAtBottom(isAtBottom);
  };

  useEffect(() => {
    if (isTerminalAtBottom && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput, isTerminalAtBottom]);

  return (
    <div className="h-64 shrink-0 bg-slate-950 border-t border-slate-800 font-mono text-[10px] flex flex-col overflow-hidden z-20 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between text-slate-500 p-2 bg-slate-900/50 border-b border-slate-800/50 shrink-0">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-3 h-3" />
          <span className="uppercase tracking-widest font-bold">
            Sandbox Logs
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[9px] text-emerald-500 font-bold animate-pulse">
            ● RUNTIME ACTIVE
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-slate-500 hover:text-white"
            onClick={onClose}
          >
            <XCircle className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div 
        ref={terminalScrollRef}
        onScroll={handleTerminalScroll}
        className="flex-1 p-3 overflow-y-auto custom-scrollbar text-slate-400 bg-black/40"
      >
        {terminalOutput.map((line, i) => (
          <div key={i} className="mb-0.5 whitespace-pre-wrap">
            {line}
          </div>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}
