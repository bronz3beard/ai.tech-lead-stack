> [!IMPORTANT] **Methodology Alignment — The Four Pillars**
>
> This skill adheres to four engineering pillars. A plan or change that violates
> any one of them fails review, even if the other three are perfect. One fatal
> flaw drives the overall judgment low — the score is holistic, not an average.
>
> **1. G-Stack Ethos — Diagnosis before Advice** (garrytan/gstack)
>
> - **Diagnose first:** begin from the real codebase (detected
>   language/framework/version, existing patterns, config). Generic,
>   stack-agnostic advice fails.
> - **User-centric reframing:** solve the underlying user pain or business goal,
>   not just the literal request. Find the better problem hiding inside the ask.
> - **Reuse before rewrite:** search for and reuse existing utilities,
>   components, and platform capabilities before writing anything new.
> - **The sprint lifecycle:** respect the phases — Think → Plan → Build → Review
>   → Test → Ship → Reflect — and don't skip ahead.
> - **User sovereignty:** advise; the human decides. Ask instead of guessing on
>   ambiguous decisions.
>
> **2. MinimumCD — Continuous Delivery & Atomic Flow** (minimumcd.org)
>
> - **Small batches / vertical slices:** decompose work into the smallest
>   end-to-end, independently deployable units. No "big-bang" changes.
> - **Trunk-based, always-releasable:** integrate continuously; every slice
>   keeps the trunk in a working, releasable state and ships only
>   forward-independent changes.
> - **Continuous verification:** each slice is proven working before the next
>   begins; when the build or tests go red, stop the line and fix before adding
>   more.
> - **Immutable, single path to production:** build an artifact once and promote
>   it unchanged; the pipeline is the only way to ship — no manual, out-of-band
>   deploys.
> - **Decouple deploy from release:** land code behind feature flags /
>   progressive rollout, and keep rollback always available. Deploying is not
>   releasing.
>
> **3. Agent Skills — Process over Prose, Evidence over Assumption**
> (addyosmani/agent-skills)
>
> - **Evidence over assumption:** "seems right" and "tested manually" are never
>   sufficient. End every gate with hard evidence — a command to run, its
>   output, or a passing test.
> - **Anti-rationalization:** never skip a quality gate, delete or skip a test,
>   or silence a check to move faster. Speed is never a reason to lower the bar.
> - **Clarity and simplicity:** prefer clear, maintainable code over cleverness;
>   reduce complexity while preserving exact behavior.
> - **Declarative over imperative:** express intent and desired state rather
>   than brittle step-by-step manipulation wherever the platform or framework
>   supports it.
> - **Verifiable, bounded steps:** each step has a clear done-condition and
>   stays inside its declared scope.
>
> **4. Modern Web Guidance — Platform First** (GoogleChrome/modern-web-guidance)
>
> - **Native over legacy:** prefer modern, native platform APIs over legacy
>   hacks and heavy third-party dependencies — e.g.
>   `navigator.clipboard.writeText` over `document.execCommand('copy')`, and the
>   Popover API, `<dialog>`, Anchor Positioning, View Transitions, and container
>   queries over JS/library reimplementations.
> - **Built-in quality:** choose solutions that give performance, accessibility,
>   and security for free — semantic HTML with ARIA kept in sync with visual
>   state, Core Web Vitals / INP awareness, and validation shown only after
>   interaction (`:user-invalid`).
> - **Progressive enhancement & responsible fallbacks:** let older browsers
>   silently ignore additive enhancements; for critical behavior write
>   lightweight, case-specific fallbacks (under ~50 LOC) or conditionally-loaded
>   polyfills — never heavy bundles.
> - **Baseline-aware:** check real browser support (the Baseline dataset) before
>   adopting a feature, and document platform gotchas and quotas.
> - **Not applicable when the task isn't web/UI:** treat this pillar as
>   satisfied for non-web work.
