import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Hammer,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6 border-b border-slate-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_65%)] from-blue-500/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Welcome to Interlink</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-6">
            Empower Your Workflow with AI Agents
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Interlink is your gateway to high-performance engineering
            collaboration. We provide specialized AI &quot;skills&quot; that act
            as intelligent assistants for every member of your team, enabling
            seamless access to shared expertise and codebase intelligence.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-20 space-y-32">
        {/* Section 1: What is Interlink? */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-500" />
              What is Interlink?
            </h2>
            <div className="prose prose-invert prose-slate max-w-none text-lg text-slate-300 space-y-6">
              <p>
                Imagine having specialized engineering experts available as
                needed to help you plan features, review code, audit security,
                and automate tedious tasks. That&apos;s Interlink.
              </p>
              <p>
                We&apos;ve built a library of <strong>Agent Skills</strong>
                —high-performance instructions that allow AI models (like
                Gemini, Claude, or GPT) to understand your project&apos;s
                specific needs and execute complex tasks with professional
                precision. Beyond simple context, you are chatting directly with
                the application and its underlying engineering ethos, ensuring
                every interaction is grounded in your project&apos;s reality.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: How It Works - The Workflow */}
        <section className="space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-indigo-500" />
              How It Works
            </h2>
            <p className="text-lg text-slate-400">
              Interlink simplifies the interaction between you and AI. Here are
              the primary ways you&apos;ll use the platform:
            </p>
          </div>

          <div className="grid gap-8">
            {/* Agent Chat */}
            <div className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">
                    1. Agent Chat
                  </h3>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    The Agent Chat is your command center. Instead of just
                    &quot;chatting&quot; with an AI, you&apos;re interacting
                    with an agent equipped with specialized skills and direct
                    access to your application. Plan features, find bugs, or
                    explain complex logic with an assistant that truly knows
                    your code.
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Directly communicate with AI agents and the application itself',
                      'Invoke specific skills for targeted tasks',
                      'Bridge the gap between planning and execution',
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-slate-400"
                      >
                        <CheckCircle2 className="w-5 h-5 text-blue-500/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Forging Skills */}
            <div className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-indigo-500/50 transition-all duration-300">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Hammer className="w-8 h-8 text-indigo-400" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">
                    2. Forging Skills
                  </h3>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Need a custom workflow? &quot;Forge Skill&quot; allows you
                    to define new capabilities for your agents. Create
                    specialized instructions that encode your team&apos;s best
                    practices, ensuring every AI-assisted task follows your
                    unique standards and the proven methodologies of our stack.
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Create custom AI skills (not just workflows)',
                      'Ensure alignment with G-Stack and MinimumCD methodologies',
                      'Standardize team best practices across the codebase',
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-slate-400"
                      >
                        <CheckCircle2 className="w-5 h-5 text-indigo-500/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: The Pillars of Excellence */}
        <section className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-10 md:p-16 space-y-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -z-10" />
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-white">
              The Three Pillars of Excellence
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Our agents are built on a foundation of elite engineering methodologies that ensure high-integrity collaboration.
            </p>
          </div>

          <div className="grid gap-8">
            {/* G-Stack */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Search className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">G-Stack <span className="text-slate-500 font-normal text-lg">(Modularity & Diagnosis-First)</span></h3>
              </div>
              <p className="text-lg text-slate-300 leading-relaxed">
                Inspired by the <a href="https://github.com/garrytan/gstack" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">garrytan/gstack</a> philosophy, this pillar mandates <strong>Diagnosis before Advice</strong>. Every skill begins with <em>Phase 0: Tech-Stack Discovery</em>. Agents must understand the project&apos;s language, framework, and constraints before proposing a single line of code.
              </p>
            </div>

            {/* MinimumCD */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">MinimumCD <span className="text-slate-500 font-normal text-lg">(Atomic Batches & Continuous Verification)</span></h3>
              </div>
              <p className="text-lg text-slate-300 leading-relaxed">
                This pillar prioritizes <strong>small, atomic batches of work</strong> (&lt;100 lines per task) and continuous automated verification. It is designed to prevent &quot;Big Bang&quot; integrations by enforcing <a href="https://beyond.minimumcd.org/docs/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">vertical slicing</a> and early detection of regression risks.
              </p>
            </div>

            {/* Agent Skills */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">Agent Skills <span className="text-slate-500 font-normal text-lg">(Production-Grade Ethos)</span></h3>
              </div>
              <p className="text-lg text-slate-300 leading-relaxed">
                Based on Addy Osmani&apos;s <a href="https://github.com/addyosmani/agent-skills" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">agent-skills</a>, this pillar treats AI agents as disciplined senior engineers rather than shortcut-taking assistants.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="font-bold text-white mb-1">Process over Prose</div>
                  <div className="text-sm text-slate-400">Structured workflows with specific verification gates.</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="font-bold text-white mb-1">Anti-Rationalization</div>
                  <div className="text-sm text-slate-400">Documented rebuttals to combat AI &quot;shortcuts&quot;.</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="font-bold text-white mb-1">Verification is Non-Negotiable</div>
                  <div className="text-sm text-slate-400">Every task ends with hard evidence. No guessing.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Next Steps */}
        <section className="text-center space-y-8">
          <h2 className="text-3xl font-bold text-white">
            Ready to dive deeper?
          </h2>
          <p className="text-xl text-slate-400">
            Explore our comprehensive directory of specialized skills tailored
            for Product Managers, Designers, and Engineers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/skills/roles"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-all group"
            >
              <BookOpen className="w-5 h-5" />
              Explore Skills by Role
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <p className="text-sm text-slate-500 pt-4">
            Find out exactly which skills can help you excel in your specific
            role.
          </p>
        </section>
      </div>

      {/* Footer-like simple note */}
      <footer className="py-20 text-center border-t border-slate-800/50">
        <p className="text-slate-500 font-medium">
          Interlink &copy; {new Date().getFullYear()} — Built for the next
          generation of builders.
        </p>
      </footer>
    </div>
  );
}
