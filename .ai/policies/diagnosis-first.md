> [!IMPORTANT] **Diagnosis before Advice (G-Stack Ethos)**
>
> **Understand the real problem and the real codebase before proposing or
> writing anything.** Generic, stack-agnostic advice is a failure mode. Every
> task begins with discovery.
>
> 1. **Phase 0 — Tech-Stack Discovery (MANDATORY).** Before any design or
>    change, detect the project's actual ecosystem: language and version,
>    framework and version, package manager, existing patterns, configuration,
>    and test setup. Read the code the task touches — do not assume. Ignore
>    binaries/images and avoid goal drift.
> 2. **User-Centric Reframing.** Solve the underlying user pain or business
>    goal, not just the literal feature requested. Interrogate the request: what
>    problem is really being solved, and what is the smallest change that solves
>    it? Reframe when the stated ask hides a better one.
> 3. **Reuse before Rewrite (CRITICAL).** Search for existing functionality,
>    utilities, components, and abstractions and reuse them before creating
>    anything new. Use the platform and the existing codebase. Net-new code is a
>    last resort, justified only when nothing suitable exists.
> 4. **Diagnose before you fix.** No fix without investigation. Trace the actual
>    data flow, reproduce the behavior, and form a hypothesis before changing
>    code. Stop and reassess after roughly three failed fix attempts instead of
>    thrashing.
> 5. **Simplicity and scope discipline (Rule 0).** Prefer the simplest solution
>    that works. Touch only what the task requires — no drive-by edits, no
>    speculative abstractions, no adjacent "while I'm here" cleanup.
