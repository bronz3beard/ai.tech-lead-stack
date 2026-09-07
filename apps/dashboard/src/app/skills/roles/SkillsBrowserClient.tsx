'use client';
import MermaidRenderer from '@/components/chat/MermaidRenderer';
import {
  Briefcase,
  Cpu,
  Layout,
  LucideIcon,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { ALL_SKILLS } from './data';

export interface SkillNode {
  name: string;
  phase?: string;
  kind: string;
  domain?: string;
  ownership?: { drive: string; approve: string };
  targets?: string[];
  minModelClass?: string;
  consumes: string[];
  emits: string[];
  surface: string;
  cost: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'requires' | 'suggests';
}

export interface GraphData {
  nodes: SkillNode[];
  edges: GraphEdge[];
  artifactFlow: any[];
}

const PHASE_ORDER = [
  'intent',
  'specify',
  'plan',
  'build',
  'review',
  'deploy',
  'scale',
  'polish',
  'maintain',
];

export function SkillsBrowserClient({ graphData }: { graphData: GraphData }) {
  const publicSkills = graphData.nodes.filter((n) => n.surface === 'public');

  // Merge legacy data for rich descriptions
  const mergedSkills = publicSkills.map((node) => {
    const legacy = ALL_SKILLS.find((s) => s.id === node.name);
    return {
      ...node,
      displayName: legacy?.name || node.name,
      description: legacy?.description || '',
      useCases: legacy?.useCases || [],
      realWorldExample: legacy?.realWorldExample || '',
    };
  });

  const orchestrators = mergedSkills.filter((s) => s.kind === 'orchestrator');
  const policies = mergedSkills.filter((s) => s.kind === 'policy');
  const reports = mergedSkills.filter((s) => s.kind === 'report');

  const getSkillsByPhase = (phase: string) => {
    return mergedSkills.filter((s) => s.kind === 'skill' && s.phase === phase);
  };

  // Generate Mermaid Pipeline View
  let mermaidChart = 'flowchart LR\n';
  mermaidChart +=
    '  classDef phase fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc\n';
  mermaidChart +=
    '  classDef skill fill:#1e293b,stroke:#10b981,stroke-width:1px,color:#f8fafc\n';

  mermaidChart += '  Intent[Intent]:::phase --> Specify[Specify]:::phase\n';
  mermaidChart += '  Specify --> Plan[Plan]:::phase\n';
  mermaidChart += '  Plan --> Build[Build]:::phase\n';
  mermaidChart += '  Build --> Review[Review]:::phase\n';
  mermaidChart += '  Review --> Deploy[Deploy]:::phase\n';
  mermaidChart += '  Deploy --> Scale[Scale]:::phase\n';
  mermaidChart += '  Scale --> Polish[Polish]:::phase\n';

  // Add requires edges between skills for a deeper view, or just keep it simple?
  // Since the prompt asks to render intent->deploy flow AND requires/suggests edges.
  // We can add nodes for the skills that have edges.
  graphData.edges.forEach((edge) => {
    if (edge.type === 'requires') {
      mermaidChart += `  ${edge.from}(${edge.from}):::skill -.->|requires| ${edge.to}(${edge.to}):::skill\n`;
    } else {
      mermaidChart += `  ${edge.from}(${edge.from}):::skill -.->|suggests| ${edge.to}(${edge.to}):::skill\n`;
    }
  });

  return (
    <div className="min-h-screen bg-slate-900/50 backdrop-blur-xl p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Interlink Skills Directory
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Discover specialized AI capabilities organized by lifecycle phase.
          </p>
        </header>

        {/* Availability Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto">
          <div className="bg-blue-500/20 p-3 rounded-xl">
            <Layout className="w-8 h-8 text-blue-400" />
          </div>
          <div className="grow text-center md:text-left">
            <h3 className="text-xl font-semibold text-white mb-1">
              Omnipresent Access
            </h3>
            <p className="text-slate-300">
              All skills are available in the **Antigravity**, **Cursor**, or
              **Continue** IDEs via workflows, as well as in our **Agent Chat**
              interface.
            </p>
          </div>
        </div>

        {/* Pipeline Graph */}
        <section className="space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
            <Sparkles className="w-8 h-8 text-indigo-400" />
            <h2 className="text-3xl font-semibold text-white">
              Lifecycle Pipeline
            </h2>
          </div>
          <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700 overflow-x-auto">
            <MermaidRenderer chart={mermaidChart} />
          </div>
        </section>

        {/* Orchestrators */}
        {orchestrators.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
              <Cpu className="w-8 h-8 text-amber-400" />
              <h2 className="text-3xl font-semibold text-white">
                Orchestrators
              </h2>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full uppercase tracking-wider">
                Multi-Phase Engines
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orchestrators.map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  icon={Cpu}
                  color="text-amber-400"
                />
              ))}
            </div>
          </section>
        )}

        {/* Policies */}
        {policies.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <h2 className="text-3xl font-semibold text-white">Policies</h2>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full uppercase tracking-wider">
                Guardrails & Rules
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {policies.map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  icon={ShieldCheck}
                  color="text-emerald-400"
                />
              ))}
            </div>
          </section>
        )}

        {/* Reports */}
        {reports.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
              <Briefcase className="w-8 h-8 text-rose-400" />
              <h2 className="text-3xl font-semibold text-white">Reports</h2>
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full uppercase tracking-wider">
                Analysis & Artifacts
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  icon={Briefcase}
                  color="text-rose-400"
                />
              ))}
            </div>
          </section>
        )}

        {/* Phases */}
        {PHASE_ORDER.map((phase) => {
          const phaseSkills = getSkillsByPhase(phase);
          if (phaseSkills.length === 0) return null;

          return (
            <section key={phase} className="space-y-6">
              <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
                <Terminal className="w-8 h-8 text-blue-400" />
                <h2 className="text-3xl font-semibold text-white capitalize">
                  {phase}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {phaseSkills.map((skill) => (
                  <SkillCard
                    key={skill.name}
                    skill={skill}
                    icon={Terminal}
                    color="text-indigo-400"
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  icon: Icon,
  color,
}: {
  skill: any;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Icon className={`w-6 h-6 shrink-0 ${color}`} />
          <h3 className="text-xl font-bold text-slate-100">
            {skill.displayName}
          </h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
          {skill.cost}
        </span>
      </div>

      <p className="text-slate-300 text-base mb-6 grow">
        {skill.description || 'No description available.'}
      </p>

      {skill.useCases && skill.useCases.length > 0 && (
        <div className="space-y-3 mt-auto">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Real-World Use Cases
          </h4>
          <ul className="space-y-2">
            {skill.useCases.map((useCase: string, index: number) => (
              <li
                key={index}
                className="flex items-start text-sm text-slate-300"
              >
                <span className="text-blue-400 mr-2 mt-0.5">•</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
