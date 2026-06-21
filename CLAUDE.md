# EdgeBoard — Project Rules

## 1. Read the PRD First

Before making any implementation decision, read `/docs/product/MVP_PRD.md`.  
Every proposal must reference the specific MVP requirement it satisfies (e.g., "satisfies PRD §5.3 Arbitrage Opportunity Finder").

## 2. MVP Scope is a Hard Boundary

If a feature, table, service, or abstraction is not in `MVP_PRD.md`, do not build it.  
When in doubt, ask: "Which acceptance criterion in the PRD does this satisfy?" If there is no answer, stop.

## 3. Fastest Path to Working

Optimize for a working product over a clean product. A rough implementation that ships beats a polished one that doesn't.  
Prefer: in-process logic, single files, direct queries.  
Defer: background workers, queues, caching layers, service boundaries.

## 4. Simple Over Scalable

Choose the implementation a solo founder can fully understand and debug at 11pm.  
Avoid: microservices, event-driven architecture, premature sharding, complex state machines.  
Use: straightforward request/response, flat data models, readable code.

## 5. No Abstractions Until Required

Do not create helper classes, utility layers, base classes, or shared modules until the same logic is needed in three or more places.  
Copy-paste twice; abstract on the third.

## 6. Solo-Founder Legibility

The codebase must be navigable by one person without documentation.  
File names, function names, and variable names should be self-explanatory.  
Avoid clever patterns. Prefer boring patterns.

## 7. Challenge Complexity

If a proposed implementation feels complex, say so and propose a simpler alternative before proceeding.  
The right question is always: "Is there a 10-line version of this?"

## 8. Justify New Database Tables

Before creating any new table, state:
- What MVP requirement it serves (PRD section reference)
- Why existing tables cannot satisfy it
- The minimum columns required — no speculative fields

## 9. Justify New Services

Before creating any new service, process, or external dependency, state:
- What MVP requirement it serves (PRD section reference)
- Why the existing service cannot handle it
- The operational cost of adding it (who restarts it when it breaks?)

## 10. Every Proposal Must Reference the PRD

Every implementation proposal — whether a new file, endpoint, schema change, or dependency — must open with:

> **MVP requirement:** [PRD section and feature name]

If no PRD section applies, the proposal is out of scope.
