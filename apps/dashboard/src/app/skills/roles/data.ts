export interface Skill {
  id: string;
  name: string;
  description: string;
  useCases: string[];
  realWorldExample?: string;
  addedAt: string;
  roles: ('PM' | 'DESIGNER' | 'QA' | 'DEVELOPER' | 'UNIVERSAL')[];
}

export const ALL_SKILLS: Array<Skill> = [
  {
    id: 'solutioning-facilitator',
    name: 'Solutioning Facilitator',
    description:
      'Facilitates a live, multi-role solutioning session and keeps a running record of every option, concern, and decision so nothing is lost or re-argued.',
    useCases: [
      'Running a live session when a feature gap surfaces mid-sprint.',
      'Keeping a Solution Ledger of every option, concern, and decision across rounds.',
      'Deciding whether to build now, spike, or defer.',
    ],
    realWorldExample:
      'A checkout flow is found to have no offline case mid-sprint; the session converges on one flagged first slice with QA acceptance criteria, and logs the rejected alternatives with reasons.',
    addedAt: '2026-07-17',
    roles: ['PM', 'DESIGNER', 'QA', 'DEVELOPER'],
  },
  {
    id: 'vertical-slice',
    name: 'Vertical Slice Decomposer',
    description:
      'Decomposes user stories into thin, independently deployable vertical slices.',
    useCases: [
      'Decomposing a large feature into 1-2 day deployable slices.',
      'Extracting technical details and design references for each slice.',
      'Deciding on beta-flags and mock vs real implementations.',
    ],
    realWorldExample:
      'Breaking down a complex "User Dashboard" epic into 4 thin vertical slices, starting with a hardcoded static layout, then progressively adding dynamic data and interactions.',
    addedAt: '2026-06-16',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'feature-orchestrator',
    name: 'Feature Orchestrator',
    description:
      'Three-Phase Feature Engine that orchestrates research, planning, and implementation steps dynamically.',
    useCases: [
      'Conducting dynamic codebase research before generating plans.',
      'Drafting detailed implementation plans with rollback strategies.',
      'Executing plans step-by-step with automated verification.',
    ],
    realWorldExample:
      'Orchestrating the rollout of a new payment provider, starting with searching for existing integrations, drafting the changes, and applying them securely.',
    addedAt: '2026-06-16',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'ui-spec-generator',
    name: 'UI Spec Generator',
    description:
      'AI-Powered UI Spec Generator that creates structural Radix/Shadcn components based on requirements.',
    useCases: [
      'Generating functional UI skeletons in a target design system folder.',
      'Mapping Figma styles to Tailwind classes automatically.',
      'Creating mock layouts for rapid stakeholder feedback.',
    ],
    realWorldExample:
      'Creating a skeleton of a user settings panel using Shadcn primitives to unblock developer data-wiring.',
    addedAt: '2026-05-14',
    roles: ['PM', 'DESIGNER', 'DEVELOPER'],
  },
  {
    id: 'design-system-review',
    name: 'Design System Review',
    description:
      'AI-augmented design system auditor that conducts multi-iteration visual reviews.',
    useCases: [
      'Auditing UI layouts against design system specifications.',
      'Iterating on CSS/Tailwind tweaks with designer-in-the-loop validation.',
      'Enforcing token and component reuse across frontend pages.',
    ],
    realWorldExample:
      'Running a design system check on a newly built checkout component to ensure button styles and spacing meet system parameters.',
    addedAt: '2026-05-08',
    roles: ['DESIGNER', 'QA', 'DEVELOPER'],
  },
  {
    id: 'weekly-leadership-report',
    name: 'Weekly Leadership Report',
    description:
      'Synthesizes cross-role team progress from Git history and ClickUp sprints into structured weekly reports.',
    useCases: [
      'Analyzing weekly Git merges and tags to track team velocity.',
      'Summarizing development, QA, and design tasks into client-ready briefs.',
      'Identifying sprint blockers and accomplishments for management.',
    ],
    realWorldExample:
      'Generating a polished executive status report summarizing a week of frontend improvements, QA test cases, and design reviews.',
    addedAt: '2026-04-17',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'pm-backlog-auditor',
    name: 'PM Backlog Auditor',
    description:
      'Audits and optimizes the product backlog, ensuring tasks are logically ordered and dependencies are respected.',
    useCases: [
      'Detecting UI tasks listed before API endpoints are ready.',
      'Identifying scope creep in mid-sprint feature requests.',
      'Re-ordering technical debt to unblock critical path features.',
    ],
    realWorldExample:
      'A PM uses the auditor to find that a "Checkout UI" task is scheduled two weeks before the "Payment API" it depends on is even started.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-story-augmenter',
    name: 'PM Story Augmenter',
    description:
      'Enhances user stories with detailed acceptance criteria, edge cases, and technical considerations.',
    useCases: [
      'Fleshing out a one-liner user story into a complete Jira ticket.',
      'Highlighting missing edge cases in a newly proposed checkout flow.',
      'Ensuring all stories follow the INVEST principle before sprint planning.',
    ],
    realWorldExample:
      'Transforming "As a user I want to reset my password" into a detailed spec covering token expiration, rate limiting, and email template requirements.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-release-note-drafter',
    name: 'PM Release Note Drafter',
    description:
      'Automatically drafts user-facing release notes from merged pull requests and resolved tickets.',
    useCases: [
      'Generating a monthly customer-facing changelog from Jira.',
      'Translating technical bug fixes into user-friendly language.',
      'Creating internal release summaries for the sales and marketing teams.',
    ],
    realWorldExample:
      'A PM generates a professional release note that describes a "database indexing optimization" as "improved search performance for faster results."',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-risk-detector',
    name: 'PM Risk Detector',
    description:
      'Proactively identifies risks in project plans, timelines, and resource allocation before they impact delivery.',
    useCases: [
      'Flagging potential bottlenecks due to single points of failure in the team.',
      'Identifying aggressive timelines that do not account for testing phases.',
      'Highlighting dependencies on external vendors that might delay the launch.',
    ],
    realWorldExample:
      'Detecting that a critical path task is assigned to the only developer who is also on vacation during the launch week.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-effort-estimator',
    name: 'PM Effort Estimator',
    description:
      'Estimate development effort based on codebase history and complexity.',
    useCases: [
      'Predicting the time required to implement a new payment gateway.',
      'Assessing the historical complexity of similar features to refine story points.',
      'Identifying overly complex tasks that should be broken down before estimation.',
    ],
    realWorldExample:
      'Using historical commit data to estimate that a new API integration will likely take 3-4 days based on previous similar integrations.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-context-summarizer',
    name: 'PM Context Summarizer',
    description:
      'Summarize recent technical progress and blockers for non-technical briefings.',
    useCases: [
      'Creating a high-level progress report for executive stakeholders.',
      'Translating a complex database migration issue into a clear business impact statement.',
      'Summarizing the root cause of a recent outage for a customer communication.',
    ],
    realWorldExample:
      'Summarizing a week of complex refactoring into a clear update for stakeholders: "Simplified the checkout logic to enable 20% faster feature development."',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-action-item-mapper',
    name: 'PM Action Item Mapper',
    description:
      'Translate meeting notes into actionable technical tasks linked to code.',
    useCases: [
      'Converting a brainstorming session transcript into Jira tickets.',
      'Identifying clear technical deliverables from a customer feedback call.',
      'Mapping product requirements documents directly to architectural components.',
    ],
    realWorldExample:
      'Turning a messy 30-minute meeting transcript into five distinct, actionable tickets with clear ownership and descriptions.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-task-specifier',
    name: 'PM Task Specifier',
    description:
      'Draft high-fidelity technical specifications for new features.',
    useCases: [
      'Writing detailed API payload requirements for a new endpoint.',
      'Defining database schema changes needed for a new user profile feature.',
      'Specifying error handling and edge cases for a third-party integration.',
    ],
    realWorldExample:
      'Drafting a technical spec for a "User Export" feature, specifying JSON format, file size limits, and security token requirements.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-progress-translator',
    name: 'PM Progress Translator',
    description:
      'Translate complex technical achievements into clear client updates.',
    useCases: [
      'Explaining a microservices architecture migration in terms of improved reliability for clients.',
      'Rewriting release notes from backend optimization to highlight faster load times for users.',
      'Communicating a security patch as a proactive data protection measure to enterprise customers.',
    ],
    realWorldExample:
      'Updating clients about a "Dockerization" effort as "Infrastructure upgrades to ensure 99.99% service availability during peak traffic."',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-newsletter-generator',
    name: 'PM Newsletter Generator',
    description:
      'Generate product-focused updates and highlights from recent code changes.',
    useCases: [
      "Compiling a monthly internal newsletter showcasing the engineering team's achievements.",
      'Drafting a customer-facing email campaign announcing new feature releases.',
      'Creating a digest of recent bug fixes to demonstrate ongoing product improvements.',
    ],
    realWorldExample:
      'Compiling the "Engineering Monthly" update that highlights the three most impactful features shipped this month.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'pm-design-system-auditor',
    name: 'PM Design System Auditor',
    description:
      'Check code implementation against design system standards and consistency.',
    useCases: [
      'Auditing a newly developed page to ensure all buttons use the correct design tokens.',
      'Identifying inconsistencies in typography across different modules of the application.',
      'Validating that new components adhere to established accessibility guidelines within the design system.',
    ],
    realWorldExample:
      'Scanning a new dashboard and finding three custom buttons that should have been using the standard "PrimaryButton" component.',
    addedAt: '2026-04-15',
    roles: ['PM'],
  },
  {
    id: 'ask',
    name: 'Ask (The Codebase Oracle)',
    description:
      'Universal codebase consultation and architectural advisor. Available to everyone for deep technical insights.',
    useCases: [
      'Querying the codebase for specific implementation details during a feasibility study.',
      'Asking for an explanation of complex legacy code before proposing changes.',
      'Getting architectural recommendations when planning a new feature.',
    ],
    realWorldExample:
      'A developer joins a legacy project and uses Ask to understand the complex authentication flow across five different microservices without having to read every line of code.',
    addedAt: '2026-04-08',
    roles: ['UNIVERSAL'],
  },
  {
    id: 'accessibility-auditor',
    name: 'Accessibility Auditor',
    description:
      'Specialized audit for Web Accessibility (A11y). Scans for contrast issues, missing semantics, ARIA debt, and keyboard navigation barriers.',
    useCases: [
      'Checking if the newly designed color palette meets WCAG AA contrast ratios.',
      'Verifying that custom dropdown components have appropriate ARIA roles.',
      'Ensuring the entire checkout flow is fully keyboard navigable.',
    ],
    realWorldExample:
      'Finding that a custom modal component was missing the `aria-modal="true"` attribute, making it invisible to screen readers.',
    addedAt: '2026-04-07',
    roles: ['DESIGNER', 'QA', 'DEVELOPER'],
  },
  {
    id: 'style-logic-exporter',
    name: 'Style Logic Exporter',
    description:
      'Extracts design tokens and style logic from code for design-to-code alignment, bridging the gap between raw code and Figma.',
    useCases: [
      'Extracting all Tailwind color variables to sync with a Figma library.',
      'Mapping coded spacing scales to update outdated design system documentation.',
      'Identifying inconsistent inline styles to unify component designs.',
    ],
    realWorldExample:
      'Exporting the actual spacing variables used in the CSS to update the outdated "Guidelines" page in Figma, ensuring 1:1 parity.',
    addedAt: '2026-03-30',
    roles: ['DESIGNER', 'DEVELOPER'],
  },
  {
    id: 'regression-bug-fix',
    name: 'Regression Bug Fix',
    description:
      'Unified Remediation Engine for resolving Design Review (DR), QA, and Regression feedback directly in the codebase.',
    useCases: [
      'Automatically patching a CSS regression introduced in the last commit.',
      'Addressing a functional bug caught by QA in the staging environment.',
      'Fixing a design misalignment reported during the final UX review.',
    ],
    realWorldExample:
      'Reading a QA bug report about a misaligned footer and automatically generating the exact CSS fix to center it across all pages.',
    addedAt: '2026-03-25',
    roles: ['QA', 'DEVELOPER'],
  },
  {
    id: 'verification-auditor',
    name: 'Verification Auditor',
    description:
      'Internal support logic for verifying local environments and evidence capture. Audits Security, Performance, and Accessibility.',
    useCases: [
      'Verifying that local testing environments are correctly configured before tests run.',
      'Auditing a new page for extreme performance regressions before sign-off.',
      'Ensuring all captured test evidence meets the required standards for compliance.',
    ],
    realWorldExample:
      'Identifying that a new third-party script added to the header increased the "Time to Interactive" by 1.5 seconds.',
    addedAt: '2026-03-25',
    roles: ['QA', 'DEVELOPER'],
  },
  {
    id: 'changelog',
    name: 'Changelog Generator',
    description:
      'Transforms raw Git commit logs and pull request history into semantic, user-centric release notes.',
    useCases: [
      'Creating public release notes for a major version release.',
      'Categorizing commits into features, fixes, and performance boosts.',
      'Automating sprint-end changelog updates for client communication.',
    ],
    realWorldExample:
      'Compiling a structured CHANGELOG.md entry from 50 developer commits, highlighting key features and deprecations.',
    addedAt: '2026-03-15',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'feature-design-assistant',
    name: 'Feature Design Assistant',
    description:
      'High-density discovery and architectural design engine. Translates vague ideas into methodology-compliant technical specifications.',
    useCases: [
      'Converting a brief idea for a dashboard into a structured UI/UX plan.',
      'Ensuring new feature designs adhere to the existing component library constraints.',
      'Drafting interaction specifications for a complex drag-and-drop interface.',
    ],
    realWorldExample:
      'Converting a loose sketch of a "User Profile" page into a structured component hierarchy with defined data requirements for each section.',
    addedAt: '2026-03-15',
    roles: ['DESIGNER', 'DEVELOPER'],
  },
  {
    id: 'product-strategist',
    name: 'Product Strategist',
    description:
      'High-density product strategy and roadmap auditor. Validates market positioning, feature prioritization, and GTM strategy against business objectives.',
    useCases: [
      'Validating if a proposed feature aligns with the quarterly OKRs.',
      'Analyzing competitor features to prioritize the next roadmap item.',
      'Assessing the technical ecosystem cost before committing to a new integration.',
    ],
    realWorldExample:
      'Analyzing whether adding a new AI feature is more valuable for current user retention compared to fixing long-standing UI bugs.',
    addedAt: '2026-03-15',
    roles: ['PM'],
  },
  {
    id: 'clean-code-audit',
    name: 'Clean Code Audit',
    description:
      'Enforce SOLID principles and architectural standards through automated code analysis.',
    useCases: [
      'Identifying violations of the Single Responsibility Principle.',
      'Finding tightly coupled modules that should be decoupled.',
      'Ensuring new code follows the established architectural patterns.',
    ],
    realWorldExample:
      'Scanning a new PR and getting a report that a service class is doing too much and should be split into three smaller, focused services.',
    addedAt: '2026-03-15',
    roles: ['DEVELOPER'],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description:
      'Pre-PR quality gatekeeper that ensures code meets specification compliance and quality standards.',
    useCases: [
      'Automated checking for common security vulnerabilities.',
      'Verifying that all new code has corresponding test coverage.',
      'Ensuring naming conventions and style guides are strictly followed.',
    ],
    realWorldExample:
      'Running a code review on a branch and catching a potential SQL injection vulnerability before it ever reaches a human reviewer.',
    addedAt: '2026-03-15',
    roles: ['DEVELOPER', 'QA'],
  },
  {
    id: 'onboard-dev',
    name: 'Onboard Dev',
    description:
      'Accelerate developer ramp-up by providing deep insights into new infrastructure and repositories.',
    useCases: [
      "Getting a high-level overview of a new repository's architecture.",
      'Understanding the deployment pipeline and environment configurations.',
      'Identifying the key entry points and core modules of a project.',
    ],
    realWorldExample:
      'A new hire uses Onboard Dev to understand the data flow between the frontend and the three different backend services in under 30 minutes.',
    addedAt: '2026-03-15',
    roles: ['DEVELOPER'],
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description:
      'Scan configurations and code for potential security vulnerabilities and compliance issues.',
    useCases: [
      'Checking for exposed API keys or secrets in the codebase.',
      'Identifying outdated dependencies with known vulnerabilities.',
      'Auditing IAM roles and permissions for least-privilege compliance.',
    ],
    realWorldExample:
      'Running a security audit that identifies a hardcoded development API key in a configuration file that was accidentally committed.',
    addedAt: '2026-03-15',
    roles: ['DEVELOPER'],
  },
  {
    id: 'strategy-target-evaluation',
    name: 'Strategy Target Evaluation',
    description:
      'High-density product strategy and roadmap audit for technical feasibility.',
    useCases: [
      'Evaluating the technical effort required for a proposed roadmap item.',
      'Analyzing if current infrastructure can support a new strategic direction.',
      'Identifying potential architectural blockers for long-term product goals.',
    ],
    realWorldExample:
      'A developer uses this to evaluate whether the proposed "Real-time Collaboration" feature is feasible with the current WebSocket implementation.',
    addedAt: '2026-03-15',
    roles: ['DEVELOPER'],
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
    realWorldExample:
      'Discovering a deeply nested module with a cyclomatic complexity of 45 that has been the source of 80% of recent regression bugs.',
    addedAt: '2026-03-15',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'visual-verifier',
    name: 'Visual Verifier',
    description:
      'Performs smoke testing and captures media evidence for any web environment to verify UI changes.',
    useCases: [
      'Capturing before-and-after screenshots to verify a bug fix across viewports.',
      'Running a quick visual smoke test on staging before a production deployment.',
      'Documenting layout shifts that occur dynamically on user interaction.',
    ],
    realWorldExample:
      'Automatically recording a video of the login flow on mobile and desktop to prove a CSS fix works across all responsive breakpoints.',
    addedAt: '2026-03-14',
    roles: ['QA', 'DEVELOPER'],
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
    realWorldExample:
      'Automatically generating a "What I did yesterday" report that links directly to the specific PRs and commits made.',
    addedAt: '2026-03-14',
    roles: ['PM', 'QA', 'DEVELOPER'],
  },
  {
    id: 'pr-automator',
    name: 'PR Automator',
    description:
      'Automates the draft pull request creation process with multi-viewport verification evidence and pre-commit code review checks.',
    useCases: [
      'Generating draft PRs with screenshots from mobile, tablet, and desktop.',
      'Running pre-PR code review checklists to catch errors.',
      'Linking PRs to issues and tracking development tasks.',
    ],
    realWorldExample:
      'Creating a draft PR for a new layout change, including captured screenshots from 3 viewports and injecting code review diagnostics directly into the description.',
    addedAt: '2026-03-14',
    roles: ['DEVELOPER'],
  },
  {
    id: 'agent-chat',
    name: 'Agent Chat',
    description:
      'Direct command center for interacting with agents equipped with full codebase access and specialized tools.',
    useCases: [
      'Pair programming on complex logic implementations.',
      'Asking for architectural reviews of new feature proposals.',
      'Brainstorming refactoring strategies for legacy modules.',
    ],
    realWorldExample:
      'A developer uses Agent Chat to plan out a new microservice, getting a step-by-step implementation guide that respects the existing project patterns.',
    addedAt: '2026-03-14',
    roles: ['DEVELOPER'],
  },
  {
    id: 'ide-skills',
    name: 'IDE Skills',
    description:
      'Seamlessly integrated workflows within Antigravity, Cursor, and Continue for real-time code assistance and automation.',
    useCases: [
      'Invoking "Fix this bug" directly from the editor.',
      'Generating unit tests for the current file with one command.',
      'Refactoring multi-file components without leaving the IDE.',
    ],
    realWorldExample:
      'Highlighting a complex function in your IDE and using an IDE skill to instantly refactor it for better readability while maintaining all tests.',
    addedAt: '2026-03-14',
    roles: ['DEVELOPER'],
  },
  {
    id: 'mission-architect',
    name: 'Mission Architect',
    description:
      'Master Blueprint Engine that orchestrates Strategy -> Research -> Plan -> Deliver for complex, multi-component features.',
    useCases: [
      'Decomposing vague feature roadmaps into high-fidelity blueprints.',
      'Analyzing cross-component dependencies and structural constraints.',
      'Enforcing strict verification gates and evidence capture at milestones.',
    ],
    realWorldExample:
      'Translating a loose epic for subscription billing integration into a structured 4-phase technical blueprint covering database schemas and UI layouts.',
    addedAt: '2026-03-25',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'pr-design-review-init',
    name: 'PR Design Review Initiation',
    description:
      'Initiate automated design review session directly from an existing GitHub Pull Request URL.',
    useCases: [
      'Bypassing code generation to run audits on existing branches.',
      'Extracting component names and repository metadata from pull request diffs.',
      'Triggering multi-iteration visual checks on active work.',
    ],
    realWorldExample:
      'Pasting a pull request URL to automatically launch a design system compliance audit on a modified navbar component.',
    addedAt: '2026-05-14',
    roles: ['DESIGNER', 'QA', 'DEVELOPER'],
  },
  {
    id: 'plan',
    name: 'Planning Expert',
    description:
      'Complete planning engine that orchestrates deep pattern discovery, vertical slicing, and safe incremental delivery checklists.',
    useCases: [
      'Performing forensic discovery of codebase patterns and constraints.',
      'Drafting detailed implementation plans with robust rollback strategies.',
      'Breaking down complex tasks into XS/S size step-by-step instructions.',
    ],
    realWorldExample:
      'Creating a step-by-step implementation plan for a new data migration, ensuring zero downtime and a clean rollback script.',
    addedAt: '2026-03-14',
    roles: ['PM', 'DEVELOPER'],
  },
  {
    id: 'plan-quick',
    name: 'Quick Planning Expert',
    description:
      'Ultra-lean strategic planning engine optimized for speed, token efficiency, and rapid MVC delivery.',
    useCases: [
      'Rapidly scoping minor feature additions or styling adjustments.',
      'Drafting minimal change checklists without heavy forensic analysis.',
      'Ensuring baseline compliance with the repository architecture in fast cycles.',
    ],
    realWorldExample:
      'Quickly drafting a plan to add a single boolean toggle to a settings page and verifying it with a simple unit test.',
    addedAt: '2026-03-14',
    roles: ['PM', 'DEVELOPER'],
  },
];
