'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, Code, Eye, Rocket, ShieldCheck, Users } from 'lucide-react';

/**
 * @desc Explains the end-to-end autonomous feature development lifecycle.
 */
export function FeatureDevelopmentGuidePanel() {
  const steps = [
    {
      title: 'Discovery & Context',
      icon: Eye,
      description:
        'Start by describing your feature idea. We focus on the "Why" and "What" first. If you provide Figma designs or existing code, the agent analyzes them to ensure architectural alignment.',
      color: 'text-blue-400',
    },
    {
      title: 'Live Visual Prototyping',
      icon: Code,
      description:
        'Iterate over your feature with live UI updates in the sandbox. See the implementation evolve in real-time as you refine requirements with the agent.',
      color: 'text-violet-400',
    },
    {
      title: 'Autonomous Generation',
      icon: Rocket,
      description:
        "Once specifications are locked, trigger the Cloud Runner. The AI agent generates production-ready code, following your project's patterns and standards.",
      color: 'text-emerald-400',
    },
    {
      title: 'Team Orchestration',
      icon: Users,
      description:
        'PMs define vision, Designers review UI/UX via the Design Gate, and Developers perform the final code review. The agent orchestrates this cross-functional workflow.',
      color: 'text-amber-400',
    },
    {
      title: 'Audit & Quality Gate',
      icon: ShieldCheck,
      description:
        'Before merging, the code undergoes an automated audit. We verify component logic, accessibility, and design system alignment (token usage, primitives).',
      color: 'text-red-400',
    },
  ];

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 mt-4 overflow-hidden">
      <CardHeader className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/20">
        <CardTitle className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
          <Book className="h-3 w-3" />
          How-To: Feature Development
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4 space-y-5">
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-3 relative">
              {i < steps.length - 1 && (
                <div className="absolute left-[9px] top-6 bottom-[-20px] w-px bg-zinc-800" />
              )}
              <div
                className={`mt-0.5 p-1 rounded-md bg-zinc-900 border border-zinc-800 ${step.color} shrink-0 z-10`}
              >
                <step.icon className="h-3 w-3" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-zinc-100 flex items-center gap-2">
                  {step.title}
                  {i === steps.length - 1 && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded uppercase tracking-tighter border border-zinc-700">
                      Coming Soon
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-zinc-800/50">
          <p className="text-[9px] text-zinc-600 italic">
            * This guide is for Product Managers, Developers, and Designers
            working on the discovery iteration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
