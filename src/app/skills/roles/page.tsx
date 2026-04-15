import { Briefcase, Palette, ShieldCheck, LucideIcon } from 'lucide-react';

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
}

const rolesData: RoleSection[] = [
  {
    role: 'Product Manager',
    icon: Briefcase,
    skills: [
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
    ],
  },
  {
    role: 'Designer',
    icon: Palette,
    skills: [
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
    ],
  },
  {
    role: 'Quality Assurance',
    icon: ShieldCheck,
    skills: [
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
    ],
  },
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

        {rolesData.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.role} className="space-y-6">
              <div className="flex items-center space-x-3 border-b border-slate-700 pb-2">
                <Icon className="w-8 h-8 text-blue-400" />
                <h2 className="text-3xl font-semibold text-white">{section.role}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <Icon className="w-6 h-6 text-indigo-400 shrink-0" />
                      <h3 className="text-xl font-bold text-slate-100">{skill.name}</h3>
                    </div>

                    <p className="text-slate-300 text-base mb-6 flex-grow">
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
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
