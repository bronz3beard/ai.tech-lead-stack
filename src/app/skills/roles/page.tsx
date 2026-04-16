import { Briefcase, Cpu, Layout, LucideIcon, Palette, ShieldCheck, Sparkles, Terminal } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  useCases: string[];
}

interface RoleSection {
  role: string;
  icon: LucideIcon;
  skills: Skill[];
  description?: string;
}

const pmSkills: Skill[] = [
  {
    id: 'pm-backlog-auditor',
    name: 'PM Backlog Auditor',
    description: 'Audits and optimizes the product backlog, ensuring tasks are logically ordered and dependencies are respected.',
    useCases: [
      'Detecting UI tasks listed before API endpoints are ready.',
      'Identifying scope creep in mid-sprint feature requests.',
      'Re-ordering technical debt to unblock critical path features.',
    ],
  },
  {
    id: 'pm-story-augmenter',
    name: 'PM Story Augmenter',
    description: 'Enhances user stories with detailed acceptance criteria, edge cases, and technical considerations.',
    useCases: [
      'Fleshing out a one-liner user story into a complete Jira ticket.',
      'Highlighting missing edge cases in a newly proposed checkout flow.',
      'Ensuring all stories follow the INVEST principle before sprint planning.',
    ],
  },
  {
    id: 'pm-release-note-drafter',
    name: 'PM Release Note Drafter',
    description: 'Automatically drafts user-facing release notes from merged pull requests and resolved tickets.',
    useCases: [
      'Generating a monthly customer-facing changelog from Jira.',
      'Translating technical bug fixes into user-friendly language.',
      'Creating internal release summaries for the sales and marketing teams.',
    ],
  },
  {
    id: 'product-strategist',
    name: 'Product Strategist',
    description: 'High-density product strategy and roadmap auditor. Validates market positioning, feature prioritization, and GTM strategy against business objectives.',
    useCases: [
      'Validating if a proposed feature aligns with the quarterly OKRs.',
      'Analyzing competitor features to prioritize the next roadmap item.',
      'Assessing the technical ecosystem cost before committing to a new integration.',
    ],
  },
  {
    id: 'pm-risk-detector',
    name: 'PM Risk Detector',
    description: 'Proactively identifies risks in project plans, timelines, and resource allocation before they impact delivery.',
    useCases: [
      'Flagging potential bottlenecks due to single points of failure in the team.',
      'Identifying aggressive timelines that do not account for testing phases.',
      'Highlighting dependencies on external vendors that might delay the launch.',
    ],
  },
  {
    id: 'pm-effort-estimator',
    name: 'PM Effort Estimator',
    description: 'Estimate development effort based on codebase history and complexity.',
    useCases: [
      'Predicting the time required to implement a new payment gateway.',
      'Assessing the historical complexity of similar features to refine story points.',
      'Identifying overly complex tasks that should be broken down before estimation.',
    ],
  },
  {
    id: 'pm-context-summarizer',
    name: 'PM Context Summarizer',
    description: 'Summarize recent technical progress and blockers for non-technical briefings.',
    useCases: [
      'Creating a high-level progress report for executive stakeholders.',
      'Translating a complex database migration issue into a clear business impact statement.',
      'Summarizing the root cause of a recent outage for a customer communication.',
    ],
  },
  {
    id: 'pm-action-item-mapper',
    name: 'PM Action Item Mapper',
    description: 'Translate meeting notes into actionable technical tasks linked to code.',
    useCases: [
      'Converting a brainstorming session transcript into Jira tickets.',
      'Identifying clear technical deliverables from a customer feedback call.',
      'Mapping product requirements documents directly to architectural components.',
    ],
  },
  {
    id: 'pm-task-specifier',
    name: 'PM Task Specifier',
    description: 'Draft high-fidelity technical specifications for new features.',
    useCases: [
      'Writing detailed API payload requirements for a new endpoint.',
      'Defining database schema changes needed for a new user profile feature.',
      'Specifying error handling and edge cases for a third-party integration.',
    ],
  },
  {
    id: 'pm-progress-translator',
    name: 'PM Progress Translator',
    description: 'Translate complex technical achievements into clear client updates.',
    useCases: [
      'Explaining a microservices architecture migration in terms of improved reliability for clients.',
      'Rewriting release notes from backend optimization to highlight faster load times for users.',
      'Communicating a security patch as a proactive data protection measure to enterprise customers.',
    ],
  },
  {
    id: 'pm-newsletter-generator',
    name: 'PM Newsletter Generator',
    description: 'Generate product-focused updates and highlights from recent code changes.',
    useCases: [
      'Compiling a monthly internal newsletter showcasing the engineering team\'s achievements.',
      'Drafting a customer-facing email campaign announcing new feature releases.',
      'Creating a digest of recent bug fixes to demonstrate ongoing product improvements.',
    ],
  },
  {
    id: 'pm-design-system-auditor',
    name: 'PM Design System Auditor',
    description: 'Check code implementation against design system standards and consistency.',
    useCases: [
      'Auditing a newly developed page to ensure all buttons use the correct design tokens.',
      'Identifying inconsistencies in typography across different modules of the application.',
      'Validating that new components adhere to established accessibility guidelines within the design system.',
    ],
  },
  {
    id: 'audit-tech-debt',
    name: 'Audit Tech Debt',
    description: 'Quantify and track structural and technical debt.',
    useCases: [
      'Identifying outdated dependencies that pose security risks.',
      'Analyzing code complexity to plan refactoring sprints.',
      'Measuring the impact of technical debt on team velocity.',
    ],
  },
  {
    id: 'standup-daily-summary',
    name: 'Standup Daily Summary',
    description: 'Analyze git activity for daily reports.',
    useCases: [
      'Generating an automated digest of team commits for morning standup.',
      'Highlighting unmerged pull requests that are blocking progress.',
      'Summarizing completed tasks to keep stakeholders informed.',
    ],
  },
];

const designerSkills: Skill[] = [
  {
    id: 'style-logic-exporter',
    name: 'Style Logic Exporter',
    description: 'Extracts design tokens and style logic from code for design-to-code alignment, bridging the gap between raw code and Figma.',
    useCases: [
      'Extracting all Tailwind color variables to sync with a Figma library.',
      'Mapping coded spacing scales to update outdated design system documentation.',
      'Identifying inconsistent inline styles to unify component designs.',
    ],
  },
  {
    id: 'accessibility-auditor',
    name: 'Accessibility Auditor',
    description: 'Specialized audit for Web Accessibility (A11y). Scans for contrast issues, missing semantics, ARIA debt, and keyboard navigation barriers.',
    useCases: [
      'Checking if the newly designed color palette meets WCAG AA contrast ratios.',
      'Verifying that custom dropdown components have appropriate ARIA roles.',
      'Ensuring the entire checkout flow is fully keyboard navigable.',
    ],
  },
  {
    id: 'feature-design-assistant',
    name: 'Feature Design Assistant',
    description: 'High-density discovery and architectural design engine. Translates vague ideas into methodology-compliant technical specifications.',
    useCases: [
      'Converting a brief idea for a dashboard into a structured UI/UX plan.',
      'Ensuring new feature designs adhere to the existing component library constraints.',
      'Drafting interaction specifications for a complex drag-and-drop interface.',
    ],
  },
];

const qaSkills: Skill[] = [
  {
    id: 'visual-verifier',
    name: 'Visual Verifier',
    description: 'Performs smoke testing and captures media evidence for any web environment to verify UI changes.',
    useCases: [
      'Capturing before-and-after screenshots to verify a bug fix across viewports.',
      'Running a quick visual smoke test on staging before a production deployment.',
      'Documenting layout shifts that occur dynamically on user interaction.',
    ],
  },
  {
    id: 'verification-auditor',
    name: 'Verification Auditor',
    description: 'Internal support logic for verifying local environments and evidence capture. Audits Security, Performance, and Accessibility.',
    useCases: [
      'Verifying that local testing environments are correctly configured before tests run.',
      'Auditing a new page for extreme performance regressions before sign-off.',
      'Ensuring all captured test evidence meets the required standards for compliance.',
    ],
  },
  {
    id: 'regression-bug-fix',
    name: 'Regression Bug Fix',
    description: 'Unified Remediation Engine for resolving Design Review (DR), QA, and Regression feedback directly in the codebase.',
    useCases: [
      'Automatically patching a CSS regression introduced in the last commit.',
      'Addressing a functional bug caught by QA in the staging environment.',
      'Fixing a design misalignment reported during the final UX review.',
    ],
  },
];

const universalSkills: Skill[] = [
  {
    id: 'ask',
    name: 'Ask (The Codebase Oracle)',
    description: 'Universal codebase consultation and architectural advisor. Available to everyone for deep technical insights.',
    useCases: [
      'Querying the codebase for specific implementation details during a feasibility study.',
      'Asking for an explanation of complex legacy code before proposing changes.',
      'Getting architectural recommendations when planning a new feature.',
    ],
  },
];

const sharedRolesData: RoleSection[] = [
  {
    role: 'Product Manager',
    icon: Briefcase,
    skills: pmSkills,
  },
  {
    role: 'Designer',
    icon: Palette,
    skills: designerSkills,
  },
  {
    role: 'Quality Assurance',
    icon: ShieldCheck,
    skills: qaSkills,
  },
];

// Developer has access to ALL skills
const developerSkills: Skill[] = [
  ...universalSkills,
  ...pmSkills,
  ...designerSkills,
  ...qaSkills,
];

export default function RolesPage() {
  return (
    <div className="min-h-screen bg-slate-900/50 backdrop-blur-xl p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Interlink Skills Directory
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Discover specialized AI capabilities tailored for your role. Enhance your workflow with these intelligent assistants.
          </p>
        </header>

        {/* Availability Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 max-w-4xl mx-auto">
          <div className="bg-blue-500/20 p-3 rounded-xl">
            <Layout className="w-8 h-8 text-blue-400" />
          </div>
          <div className="grow text-center md:text-left">
            <h3 className="text-xl font-semibold text-white mb-1">Omnipresent Access</h3>
            <p className="text-slate-300">
              All skills are available in the **Antigravity** or **Cursor** IDEs via workflows, 
              as well as in our **Agent Chat** interface.
            </p>
          </div>
        </div>

        {/* Universal Skills Section */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
            <Sparkles className="w-8 h-8 text-amber-400" />
            <h2 className="text-3xl font-semibold text-white">Universal Tools</h2>
            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full uppercase tracking-wider">Available to All</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {universalSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} icon={Sparkles} color="text-amber-400" />
            ))}
          </div>
        </section>

        {/* Role Sections */}
        {sharedRolesData.map((section) => (
          <section key={section.role} className="space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
              <section.icon className="w-8 h-8 text-blue-400" />
              <h2 className="text-3xl font-semibold text-white">{section.role}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.skills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} icon={section.icon} color="text-indigo-400" />
              ))}
            </div>
          </section>
        ))}

        {/* Developer Section (All Inclusive) */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
            <Terminal className="w-8 h-8 text-emerald-400" />
            <h2 className="text-3xl font-semibold text-white">Developer</h2>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full uppercase tracking-wider">Full Stack Access</span>
          </div>

          <div className="bg-slate-800/40 rounded-2xl p-8 border border-slate-700/50">
            <p className="text-slate-300 mb-8 max-w-3xl">
              Developers have unhindered access to every capability in the Interlink system. 
              The following represents the full suite of specialized AI tools available for architectural, logic, and operational excellence.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {developerSkills.map((skill) => (
                <div key={skill.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/30 flex items-center space-x-3 group hover:border-emerald-500/50 transition-colors">
                  <Cpu className="w-4 h-4 text-emerald-500/50 group-hover:text-emerald-400" />
                  <span className="text-sm font-medium text-slate-200">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SkillCard({ skill, icon: Icon, color }: { skill: Skill; icon: LucideIcon; color: string }) {
  return (
    <div
      className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
    >
      <div className="flex items-center space-x-3 mb-4">
        <Icon className={`w-6 h-6 shrink-0 ${color}`} />
        <h3 className="text-xl font-bold text-slate-100">{skill.name}</h3>
      </div>

      <p className="text-slate-300 text-base mb-6 grow">
        {skill.description}
      </p>

      <div className="space-y-3 mt-auto">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Real-World Use Cases
        </h4>
        <ul className="space-y-2">
          {skill.useCases.map((useCase, index) => (
            <li key={index} className="flex items-start text-sm text-slate-300">
              <span className="text-blue-400 mr-2 mt-0.5">•</span>
              <span>{useCase}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
