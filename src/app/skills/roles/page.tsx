'use client';

import { useState } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Cpu, Layout, LucideIcon, Palette, ShieldCheck, Sparkles, Terminal } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  useCases: string[];
  realWorldExample?: string;
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
    realWorldExample: 'A PM uses the auditor to find that a "Checkout UI" task is scheduled two weeks before the "Payment API" it depends on is even started.',
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
    realWorldExample: 'Transforming "As a user I want to reset my password" into a detailed spec covering token expiration, rate limiting, and email template requirements.',
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
    realWorldExample: 'A PM generates a professional release note that describes a "database indexing optimization" as "improved search performance for faster results."',
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
    realWorldExample: 'Analyzing whether adding a new AI feature is more valuable for current user retention compared to fixing long-standing UI bugs.',
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
    realWorldExample: 'Detecting that a critical path task is assigned to the only developer who is also on vacation during the launch week.',
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
    realWorldExample: 'Using historical commit data to estimate that a new API integration will likely take 3-4 days based on previous similar integrations.',
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
    realWorldExample: 'Summarizing a week of complex refactoring into a clear update for stakeholders: "Simplified the checkout logic to enable 20% faster feature development."',
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
    realWorldExample: 'Turning a messy 30-minute meeting transcript into five distinct, actionable tickets with clear ownership and descriptions.',
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
    realWorldExample: 'Drafting a technical spec for a "User Export" feature, specifying JSON format, file size limits, and security token requirements.',
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
    realWorldExample: 'Updating clients about a "Dockerization" effort as "Infrastructure upgrades to ensure 99.99% service availability during peak traffic."',
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
    realWorldExample: 'Compiling the "Engineering Monthly" update that highlights the three most impactful features shipped this month.',
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
    realWorldExample: 'Scanning a new dashboard and finding three custom buttons that should have been using the standard "PrimaryButton" component.',
  },
];

const sharedSkills: Skill[] = [
  {
    id: 'audit-tech-debt',
    name: 'Audit Tech Debt',
    description: 'Quantify and track structural and technical debt.',
    useCases: [
      'Identifying outdated dependencies that pose security risks.',
      'Analyzing code complexity to plan refactoring sprints.',
      'Measuring the impact of technical debt on team velocity.',
    ],
    realWorldExample: 'Discovering a deeply nested module with a cyclomatic complexity of 45 that has been the source of 80% of recent regression bugs.',
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
    realWorldExample: 'Automatically generating a "What I did yesterday" report that links directly to the specific PRs and commits made.',
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
    realWorldExample: 'Exporting the actual spacing variables used in the CSS to update the outdated "Guidelines" page in Figma, ensuring 1:1 parity.',
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
    realWorldExample: 'Finding that a custom modal component was missing the `aria-modal="true"` attribute, making it invisible to screen readers.',
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
    realWorldExample: 'Converting a loose sketch of a "User Profile" page into a structured component hierarchy with defined data requirements for each section.',
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
    realWorldExample: 'Automatically recording a video of the login flow on mobile and desktop to prove a CSS fix works across all responsive breakpoints.',
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
    realWorldExample: 'Identifying that a new third-party script added to the header increased the "Time to Interactive" by 1.5 seconds.',
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
    realWorldExample: 'Reading a QA bug report about a misaligned footer and automatically generating the exact CSS fix to center it across all pages.',
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
    realWorldExample: 'A developer joins a legacy project and uses Ask to understand the complex authentication flow across five different microservices without having to read every line of code.',
  },
];

const sharedRolesData: RoleSection[] = [
  {
    role: 'Product Manager',
    icon: Briefcase,
    skills: [...pmSkills, ...sharedSkills],
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

const devSpecificSkills: Skill[] = [
  {
    id: 'agent-chat',
    name: 'Agent Chat',
    description: 'Direct command center for interacting with agents equipped with full codebase access and specialized tools.',
    useCases: [
      'Pair programming on complex logic implementations.',
      'Asking for architectural reviews of new feature proposals.',
      'Brainstorming refactoring strategies for legacy modules.',
    ],
    realWorldExample: 'A developer uses Agent Chat to plan out a new microservice, getting a step-by-step implementation guide that respects the existing project patterns.',
  },
  {
    id: 'ide-skills',
    name: 'IDE Skills',
    description: 'Seamlessly integrated workflows within Antigravity and Cursor for real-time code assistance and automation.',
    useCases: [
      'Invoking "Fix this bug" directly from the editor.',
      'Generating unit tests for the current file with one command.',
      'Refactoring multi-file components without leaving the IDE.',
    ],
    realWorldExample: 'Highlighting a complex function in Cursor and using an IDE skill to instantly refactor it for better readability while maintaining all tests.',
  },
  {
    id: 'clean-code-audit',
    name: 'Clean Code Audit',
    description: 'Enforce SOLID principles and architectural standards through automated code analysis.',
    useCases: [
      'Identifying violations of the Single Responsibility Principle.',
      'Finding tightly coupled modules that should be decoupled.',
      'Ensuring new code follows the established architectural patterns.',
    ],
    realWorldExample: 'Scanning a new PR and getting a report that a service class is doing too much and should be split into three smaller, focused services.',
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Pre-PR quality gatekeeper that ensures code meets specification compliance and quality standards.',
    useCases: [
      'Automated checking for common security vulnerabilities.',
      'Verifying that all new code has corresponding test coverage.',
      'Ensuring naming conventions and style guides are strictly followed.',
    ],
    realWorldExample: 'Running a code review on a branch and catching a potential SQL injection vulnerability before it ever reaches a human reviewer.',
  },
  {
    id: 'onboard-dev',
    name: 'Onboard Dev',
    description: 'Accelerate developer ramp-up by providing deep insights into new infrastructure and repositories.',
    useCases: [
      'Getting a high-level overview of a new repository\'s architecture.',
      'Understanding the deployment pipeline and environment configurations.',
      'Identifying the key entry points and core modules of a project.',
    ],
    realWorldExample: 'A new hire uses Onboard Dev to understand the data flow between the frontend and the three different backend services in under 30 minutes.',
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Scan configurations and code for potential security vulnerabilities and compliance issues.',
    useCases: [
      'Checking for exposed API keys or secrets in the codebase.',
      'Identifying outdated dependencies with known vulnerabilities.',
      'Auditing IAM roles and permissions for least-privilege compliance.',
    ],
    realWorldExample: 'Running a security audit that identifies a hardcoded development API key in a configuration file that was accidentally committed.',
  },
  {
    id: 'strategy-target-evaluation',
    name: 'Strategy Target Evaluation',
    description: 'High-density product strategy and roadmap audit for technical feasibility.',
    useCases: [
      'Evaluating the technical effort required for a proposed roadmap item.',
      'Analyzing if current infrastructure can support a new strategic direction.',
      'Identifying potential architectural blockers for long-term product goals.',
    ],
    realWorldExample: 'A developer uses this to evaluate whether the proposed "Real-time Collaboration" feature is feasible with the current WebSocket implementation.',
  },
];

// Developer section: Everything except PM skills and "Ask"
const developerSkills: Skill[] = [
  ...devSpecificSkills,
  ...designerSkills,
  ...qaSkills,
  ...sharedSkills,
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

          <div className="bg-slate-800/40 rounded-3xl p-8 md:p-12 border border-slate-700/50 space-y-10">
            <p className="text-slate-300 text-lg md:text-xl max-w-3xl leading-relaxed">
              Developers have unhindered access to every capability in the Interlink system. 
              The following represents the specialized AI tools available for architectural, logic, and operational excellence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {developerSkills.map((skill) => (
                <ExpandableSkillBadge key={skill.id} skill={skill} />
              ))}
            </div>

            <div className="pt-8 border-t border-slate-700/30">
              <p className="text-slate-500 text-sm italic flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500/40" />
                <em>Note: PM-specific skills are also fully available to Developers via the Antigravity/Cursor IDEs and our Agent Chat interface.</em>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExpandableSkillBadge({ skill }: { skill: Skill }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-slate-900/40 rounded-lg border transition-all duration-300 overflow-hidden ${
        isExpanded ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-slate-700/30 hover:border-emerald-500/50'
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between group transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center space-x-3">
          <Cpu className={`w-4 h-4 transition-colors ${isExpanded ? 'text-emerald-400' : 'text-emerald-500/50 group-hover:text-emerald-400'}`} />
          <span className="text-sm font-medium text-slate-200">{skill.name}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-6 pt-2 space-y-6 border-t border-slate-800/50 bg-slate-900/20">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-emerald-500/70 uppercase tracking-widest">Description</h4>
            <p className="text-slate-300 text-base leading-relaxed">
              {skill.description}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-emerald-500/70 uppercase tracking-widest">Key Use Cases</h4>
            <ul className="space-y-2">
              {skill.useCases.map((useCase, index) => (
                <li key={index} className="flex items-start text-sm text-slate-300">
                  <span className="text-emerald-500/60 mr-2 mt-1">•</span>
                  <span>{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          {skill.realWorldExample && (
            <div className="space-y-2 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Real-World Example
              </h4>
              <p className="text-slate-300 text-sm italic leading-relaxed">
                "{skill.realWorldExample}"
              </p>
            </div>
          )}
        </div>
      )}
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
