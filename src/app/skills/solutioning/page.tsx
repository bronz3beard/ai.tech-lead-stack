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
            When a team finds a gap in a feature mid-flight, the fix usually gets argued out on the spot — and the reasoning evaporates the moment the call ends. The Solutioning Facilitator runs that conversation as a structured interview and keeps a perfect, running record of every option, objection, and decision.
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
              This facilitator fixes the process, not the product. It refuses to jump to solutions before the problem is agreed, interviews one role at a time, and maintains a Solution Ledger it restates every round so nothing is lost and nothing gets re-litigated. It works in any LLM (Claude, ChatGPT, or Gemini) and is strictly advisory — it produces a decision record and backlog-ready stories, it does not touch code.
            </p>
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
            <li>Get the people who are actually in the room — ideally PM, Design, QA, and a frontend and backend developer.</li>
            <li>Copy the system prompt below into a new chat in Claude, ChatGPT, or Gemini.</li>
            <li>Send the opening message, naming the feature and who is present.</li>
            <li>Answer its questions one at a time. When more than one person is typing, prefix answers with your role (for example, &quot;QA: this needs an offline case&quot;).</li>
            <li>When it converges, ask it to emit the Decision Record and a backlog-ready story. That is what you take out of the room.</li>
          </ol>
          <div className="space-y-6 pt-4">
            <CopyBlock label="System prompt" text={SOLUTIONING_SYSTEM_PROMPT} />
            <CopyBlock label="Opening message" text={SOLUTIONING_OPENING_MESSAGE} />
          </div>
        </section>
      </div>
    </div>
  );
}
