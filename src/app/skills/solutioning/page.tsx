import {
  Briefcase,
  Cpu,
  Layout,
  ListChecks,
  Palette,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { CopyBlock } from '@/components/skills/CopyBlock';
import {
  SOLUTIONING_OPENING_MESSAGE,
  SOLUTIONING_SYSTEM_PROMPT,
} from './prompt';

const ROLES = [
  { icon: Briefcase, name: 'PM', blurb: 'Owns the problem, priority, scope, and the user/business outcome.' },
  { icon: Palette, name: 'Design', blurb: 'Owns UX, flows, consistency, and accessibility.' },
  { icon: ShieldCheck, name: 'QA', blurb: 'Owns testability, edge cases, and acceptance criteria.' },
  { icon: Layout, name: 'Frontend', blurb: 'Owns client feasibility, effort, and how the UX is built.' },
  { icon: Cpu, name: 'Backend', blurb: 'Owns data, contracts, services, feasibility, and effort.' },
];

const OUTCOMES = [
  { name: 'Decision', blurb: 'A chosen option, a thin first slice to build, and acceptance criteria QA can verify.' },
  { name: 'Spike', blurb: 'The team does not know enough yet, so it agrees a timeboxed research task with an owner and a specific question to answer.' },
  { name: 'Triage / Defer', blurb: 'The gap is logged and prioritised, then parked with an explicit reason. A valid, honest outcome.' },
];

export default function SolutioningPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      <section className="relative overflow-hidden py-20 px-6 border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Users className="w-4 h-4" />
            <span>Team Facilitator</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-6">
            Solutioning Facilitator
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            When a team finds a gap in a feature mid-flight, the fix usually gets argued out on the spot — and the reasoning evaporates the moment the call ends. This facilitator runs that conversation as a structured interview inside a coding agent that can see your repo, and keeps a perfect, running record of every option, objection, and decision.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-20 space-y-24">
        <section className="space-y-4">
          <h2 className="text-3xl font-bold text-white">Why this exists</h2>
          <div className="prose prose-invert prose-slate max-w-none text-lg text-slate-300 space-y-6">
            <p>
              Solutioning — proposing and comparing fixes on the fly when a requirement turns out to be missing — is where a lot of real design happens. It is also where a lot goes wrong: the loudest voice wins, QA and Design get talked over, decisions get made but never written down, and next sprint the team re-argues something it already settled.
            </p>
            <p>
              This facilitator fixes the process, not the product. It refuses to jump to solutions before the problem is agreed, interviews one role at a time, and maintains a Solution Ledger it restates every round so nothing is lost and nothing gets re-litigated. You run it inside a coding agent connected to your repository — your IDE agent (Cursor, Antigravity, Continue) or the tech-lead-stack Agent Chat — so its options stay grounded in the real code. It is strictly advisory: it produces a decision record and backlog-ready stories, it does not write code.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-bold text-white">What it needs to be useful</h2>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3 text-slate-300">
            <p>This is not a generic chatbot session. To give grounded answers it needs three things:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><span className="font-semibold text-slate-100">A code-connected agent</span> — your IDE agent (Cursor, Antigravity, Continue) or the tech-lead-stack Agent Chat, with this repo loaded. That lets it inspect the real code for feasibility, effort, and where the gap actually lives.</li>
              <li><span className="font-semibold text-slate-100">The actual user story / task</span> — pasted in, or (in Agent Chat) pulled from its ClickUp link. This is the anchor for the whole session.</li>
              <li><span className="font-semibold text-slate-100">The designs, if any</span> — a Figma link for the Design role. In an IDE with the Figma MCP, the agent can pull the frames itself.</li>
            </ul>
            <p className="text-sm text-slate-400">Without these it will still facilitate, but its options and estimates won&apos;t be grounded in your reality.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-white">The five voices in the room</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ROLES.map(({ icon: Icon, name, blurb }) => (
              <div key={name} className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-6 h-6 text-indigo-400 shrink-0" />
                  <h3 className="text-xl font-bold text-slate-100">{name}</h3>
                </div>
                <p className="text-slate-300 text-base">{blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-emerald-400" />
            It never forgets — the Solution Ledger
          </h2>
          <div className="prose prose-invert prose-slate max-w-none text-lg text-slate-300 space-y-6">
            <p>
              The facilitator keeps one structured record as the single source of truth and re-emits it every round. Every option gets a stable ID and a status (proposed, exploring, parked, chosen, or rejected). Every concern is attached to an option and tagged with the role that raised it. Decisions are never overwritten — a change of mind is logged as a new decision that supersedes the old one, so the history stays visible.
            </p>
            <p>
              Rejected options stay on the board with the reason they were rejected, which is what stops the team from re-arguing them later. The ledger tracks the agreed problem and its type (defect vs missing capability), constraints, options, open questions, spikes, decisions, rejected options, and the single most valuable next step.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-white">Three ways a session ends</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {OUTCOMES.map(({ name, blurb }) => (
              <div key={name} className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-2">{name}</h3>
                <p className="text-slate-300 text-base">{blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-white">How to run a session</h2>
          <ol className="list-decimal list-inside space-y-3 text-lg text-slate-300">
            <li>Open a coding agent that has this repository loaded — your IDE agent (Cursor, Antigravity, or Continue) or the tech-lead-stack Agent Chat. It must be connected to your codebase.</li>
            <li>Paste the system prompt below.</li>
            <li>Paste the opening message below.</li>
            <li>Paste the user story / task you are solutioning — copy it from ClickUp. This is the anchor for the session.</li>
            <li>Optional: paste the task&apos;s URL.</li>
            <li>Optional: paste the Figma design URL — or, in an IDE with the Figma MCP connected, let the agent pull the frames itself.</li>
            <li>Send the message and answer the interview one role at a time. When it converges, ask it to emit the Decision Record and a backlog-ready story.</li>
          </ol>
          <div className="space-y-6 pt-4">
            <CopyBlock label="System prompt" text={SOLUTIONING_SYSTEM_PROMPT} />
            <CopyBlock label="Opening message" text={SOLUTIONING_OPENING_MESSAGE} />
          </div>
          <p className="text-sm text-slate-400 pt-2">
            Today this is a manual flow — you bring the task text and design link into the chat yourself (v1). Auto-pulling the ClickUp task and Figma designs from a URL inside Agent Chat is the next step.
          </p>
        </section>
      </div>
    </div>
  );
}
