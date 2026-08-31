# ADR 0001: Packaging and Dependencies

## Context
We are establishing the foundational packaging strategy for the Zenith Foundry ecosystem. We need to define how packages are scoped, how they depend on each other, and when they will be published.

## Decision

### 1. Scoped Package Graph
Packages have been mapped to the `@zenithfoundry` npm scope according to the following graph:
- **@zenithfoundry/iris** (app, private)
- **@zenithfoundry/slm-gate** (library, public)
- **@zenithfoundry/tech-lead-stack** (library, public)
- **@zenithfoundry/voice-relay** (library, public)

### 2. Dependency Management
Inter-package consumption MUST be implemented via standard npm dependencies. The use of git submodules is explicitly forbidden across these repositories.

### 3. Publishing Strategy
Publishing to the npm registry is handled on a per-phase basis. Packages are not published at this current stage (P0.1).

### 4. Exceptions
- The Next.js dashboard repository remains under the `bronz3beard` namespace on GitHub and is not included in this scoping phase.
- **voice-relay** is currently nested inside the `tech-lead-stack` repository. It will be extracted into its own standalone repository in phase P3.1.
