'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function DiscoveryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isSandboxReady, setIsSandboxReady] = useState(false);

  useEffect(() => {
    // TODO: Initialize WebContainer API here
    // import { WebContainer } from '@webcontainer/api';
    // WebContainer.boot().then(...)
    setTimeout(() => {
      setIsSandboxReady(true);
    }, 1500);
  }, []);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');

    // TODO: Send to tech-lead-stack API (Creator Model) and stream response
    // Simulated response:
    setTimeout(() => {
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: 'I am scaffolding the feature now. You will see the sandbox update shortly.' }
      ]);
    }, 1000);
  };

  const handleFinishDiscovery = async () => {
    // TODO: Trigger Phase 3 (GitHub Action / Audit Phase)
    router.push('/feature-development/in-progress');
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-950 text-slate-50 dark overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-6 bg-slate-900">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-white">Requirements Discovery</h1>
        </div>
        <Button 
          onClick={handleFinishDiscovery} 
          variant="default"
          disabled={!hasStarted}
          className={!hasStarted ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}
        >
          Finish Discovery & Audit
        </Button>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Chat Interface */}
        <section className="flex w-1/3 flex-col border-r border-slate-800 bg-slate-900">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-slate-400 mt-10">
                Start by describing the feature you want to build.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-900/40 ml-8 border border-blue-800/50' : 'bg-slate-800 mr-8 border border-slate-700'}`}>
                  <p className="text-sm font-medium mb-1">{msg.role === 'user' ? 'You' : 'AI Assistant'}</p>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-900">
            <div className="flex space-x-2">
              <Input 
                value={input} 
                onChange={e => setInput(e.target.value)}
                placeholder="Describe the feature..."
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
              />
              <Button onClick={handleSendMessage} variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-white">Send</Button>
            </div>
          </div>
        </section>

        {/* WebContainer Sandbox Preview */}
        <section className="flex-1 bg-slate-950 p-4 relative">
          <Card className="w-full h-full flex flex-col overflow-hidden shadow-inner border-slate-800 bg-slate-900">
            <div className="h-10 border-b border-slate-800 flex shrink-0 items-center px-4 bg-slate-950">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="ml-4 text-xs font-mono text-slate-500">Live Preview (WebContainer)</div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-slate-950 overflow-hidden">
              {!isSandboxReady ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-100"></div>
                  <p className="text-sm text-slate-400">Booting Node.js environment...</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-slate-500 mb-2">Sandbox Ready</p>
                  <p className="text-sm text-slate-400 max-w-sm">
                    The Next.js app is running in your browser. As the AI generates code, this view will hot-reload instantly.
                  </p>
                </div>
                // TODO: Render the WebContainer iframe here
              )}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
