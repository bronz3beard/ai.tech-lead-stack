---
name: capacity-planner
description:
  'Evaluates production capacity and defines performance budgets for a newly
  deployed release.'
cost: ~750 tokens
modes: [read-only]
surface: public
how: 'Analyzes system architecture and load metrics against target capacity.'
useCase: 'Planning infrastructure scale-out before a major marketing launch.'
phase: scale
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets:
  - local
  - api
  - subscription
minModelClass: small
consumes:
  - release
emits:
  - review-report
---

# Capacity Planner

The Capacity Planner is designed for the `scale` phase of the lifecycle. It
ensures that any recently shipped features or newly deployed architectures are
evaluated for performance bottlenecks and capacity constraints before they
encounter peak traffic.

## G-Stack Methodology: Diagnosis First

Before proposing any scaling architecture or changes to performance budgets, the
agent MUST:

1. Review the existing system architecture (Phase 0).
2. Analyze the current metrics and deployment configurations.
3. Understand the target user concurrency and data throughput limits.

## How to use

Invoke this skill by providing a `release` artifact or metrics payload:

```md
Please run the capacity-planner skill on the new authentication service release
to ensure it can handle 10k concurrent logins per minute.
```

## Expected Output

The skill will emit a `review-report` containing:

- Current capacity limits and identified bottlenecks.
- Recommended performance budgets (e.g., maximum payload sizes, target response
  times).
- Suggested scaling strategies (e.g., read replicas, caching layers).
