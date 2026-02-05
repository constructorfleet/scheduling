# Spawn Subagent - Visual Guide & Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Scheduling Project                          │
│                                                              │
│  spawnSubagent Tool enables agent-to-agent coordination    │
└─────────────────────────────────────────────────────────────┘
```

## 9-Agent Architecture

```
                            ┌─────────────────────┐
                            │ Product & Domain    │
                            │ Agent               │
                            │ (Requirements)      │
                            └──────────┬──────────┘
                                       │ Rules catalog
                                       │ User stories
                                       │
                            ┌──────────▼──────────┐
                            │ Solution Architect  │
                            │ (Architecture)      │
                            └──────────┬──────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        │              │              │
        ┌───────────────▼────┐  ┌──────▼─────────┐   │
        │ Data Model Agent   │  │ UX Agent       │   │
        │ (Schema)           │  │ (Wireframes)   │   │
        └───────────┬────────┘  └──────┬─────────┘   │
                    │                  │              │
        ┌───────────▼──────────┐   ┌───▼─────────────▼───┐
        │ Rules Engine Agent   │   │ Frontend Engineer   │
        │ (Compliance)         │   │ (Implementation)    │
        └──────────────────────┘   └─────────┬───────────┘
                    │                        │
                    └────────────┬───────────┘
                                 │
                    ┌────────────▼───────────┐
                    │ QA & Testing Agent     │
                    │ (Verification)         │
                    └────────────┬───────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Documentation Agent    │
                    │ (User Guides)          │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Deployment Agent       │
                    │ (CI/CD & Launch)       │
                    └────────────────────────┘
```

## Sequential vs. Parallel Execution

### Sequential (What we'd do without the tool)
```
Agent 1 (60 min)
     ↓
Agent 2 (30 min)
     ↓
Agent 3 (90 min)
        ↓
TOTAL TIME: 180 minutes (3 hours)
```

### Parallel (What we can do with spawnSubagent)
```
Agent 1 (60 min)
     ↓
Agent 2 ─────┬─── Agent 3 (both 30-90 min, simultaneous)
             ├─── Agent 4
             ├─── Agent 5
             └─── Agent 6
        ↓
TOTAL TIME: 150 minutes (2.5 hours) - 25% faster!
```

## Data Flow Through System

```
┌──────────┐
│  Input   │  (requirements, policies, preferences)
└────┬─────┘
     │
     ▼
┌──────────────────────────┐
│ Product & Domain Agent   │
│ Discovers rules          │
└────┬─────────────────────┘
     │
     ├─ rules: Array
     ├─ stories: Array
     ├─ edgeCases: Array
     └─ conflicts: Array
     │
     ▼
┌──────────────────────────┐
│ Solution Architect       │
│ Designs system           │
└────┬─────────────────────┘
     │
     ├─ architecture: Design
     ├─ modules: Array
     ├─ techStack: Choices
     └─ rationale: Doc
     │
     ▼
┌──────────────────────────┐
│ Data Model Agent         │
│ Designs schema           │
└────┬─────────────────────┘
     │
     ├─ entities: Array
     ├─ relationships: Array
     ├─ constraints: Array
     └─ queries: Array
     │
     ▼
 [Multiple agents in parallel]
     │
     ├─► Rules Engine → Implementation + Tests
     ├─► UX Agent → Design → Frontend → Implementation
     ├─► Deployment Agent → Build scripts + CI/CD
     │
     ▼
┌──────────────────────────┐
│ QA & Testing Agent       │
│ Tests everything         │
└────┬─────────────────────┘
     │
     ├─ unitTests: Array
     ├─ integrationTests: Array
     ├─ e2eTests: Array
     └─ coverageReport: Metrics
     │
     ▼
┌──────────────────────────┐
│ Documentation Agent      │
│ Writes guides            │
└────┬─────────────────────┘
     │
     ├─ userGuides: Docs
     ├─ technicalDocs: Docs
     ├─ tutorials: Videos
     └─ troubleshooting: FAQ
     │
     ▼
┌──────────────────────────┐
│ Deployment Agent         │
│ Launches app             │
└────┬─────────────────────┘
     │
     └─────────────┐
                   │
                   ▼
           ┌──────────────┐
           │   LAUNCHED! │
           │   App Live   │
           └──────────────┘
```

## spawnSubagent Tool Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│                  spawnSubagent Tool                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT PARAMETERS:                                          │
│  ┌──────────────────────────────────────────────┐           │
│  │ targetAgent: string (which agent to call)   │           │
│  │ task: string (what to do)                  │           │
│  │ prompt: string (detailed instructions)     │           │
│  │ context?: object (prior work)              │           │
│  │ expectedOutputFormat?: string              │           │
│  │ timeoutMinutes?: number                    │           │
│  └──────────────────────────────────────────────┘           │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │ Validation & Routing                        │           │
│  │ - Check agent exists                        │           │
│  │ - Validate prompt is specific               │           │
│  │ - Prepare execution context                 │           │
│  └──────────────────────────────────────────────┘           │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │ Agent Execution                             │           │
│  │ - Agent processes task                      │           │
│  │ - Produces structured result                │           │
│  │ - Returns artifacts if created              │           │
│  └──────────────────────────────────────────────┘           │
│                        │                                    │
│                        ▼                                    │
│  OUTPUT (SubagentResponse):                                │
│  ┌──────────────────────────────────────────────┐           │
│  │ status: 'completed' | 'failed' | 'timeout'  │           │
│  │ result: object (structured output)          │           │
│  │ summary: string (what was done)             │           │
│  │ artifacts: { filePath, data, url }          │           │
│  │ durationSeconds: number                     │           │
│  │ errors?: Array<string>                      │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
                    spawnSubagent call
                           │
                           ▼
        ┌────────────────────────────────────┐
        │ Does agent exist?                  │
        └────────┬───────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
       NO                YES
         │                │
         │                ▼
         │      ┌────────────────────────────┐
         │      │ Is prompt specific enough? │
         │      └────────┬───────────────────┘
         │               │
         │       ┌───────┴────────┐
         │       │                │
         │      NO               YES
         │       │                │
         │       │                ▼
         │       │      ┌──────────────────────┐
         │       │      │ Execute task         │
         │       │      └────────┬─────────────┘
         │       │               │
         │       │       ┌───────┴──────────┐
         │       │       │                  │
         │       │   SUCCESS         TIMEOUT/FAIL
         │       │       │                  │
         ▼       ▼       ▼                  ▼
    ┌──────┐ ┌──────┐ ┌────────┐     ┌──────────┐
    │ Error│ │Error │ │Result  │     │  Retry?  │
    │Found │ │Found │ │Found   │     │  Error   │
    └──────┘ └──────┘ └────────┘     └──────────┘
```

## Timeline: 5-Phase Project

```
PHASE 1: Discovery
┌───────────────────────────────────────────┐
│ Product Agent gathers requirements        │
│ Time: 60 minutes                          │
│ Output: Rules catalog, user stories       │
└───────────────────────────────────────────┘
                        │
                        ▼ (60 min elapsed)

PHASE 2: Design
┌───────────────────────────────────────────┐
│ Architect & Data Model Agent (parallel)   │
│ Time: 30 minutes                          │
│ Output: Architecture, schema               │
└───────────────────────────────────────────┘
                        │
                        ▼ (90 min elapsed)

PHASE 3: Implementation
┌────────────────────────────────────────────────┐
│ 3 agents in parallel (Rules, UI, Deployment) │
│ Time: 120 minutes                            │
│ Output: Code, components, scripts            │
└────────────────────────────────────────────────┘
                        │
                        ▼ (210 min elapsed)

PHASE 4: Testing
┌───────────────────────────────────────────┐
│ QA Agent creates comprehensive tests      │
│ Time: 120 minutes                         │
│ Output: Test suite, coverage report       │
└───────────────────────────────────────────┘
                        │
                        ▼ (330 min elapsed)

PHASE 5: Launch
┌───────────────────────────────────────────┐
│ Documentation & Deployment (parallel)     │
│ Time: 60 minutes                          │
│ Output: Docs, deployed app                │
└───────────────────────────────────────────┘
                        │
                        ▼ (390 min elapsed)

🎉 PROJECT COMPLETE: 6.5 hours total time
```

## Agent Interaction Matrix

```
           ↓ To
From →     P  A  D  R  U  F  Q  C  V
┌────────┐────────────────────────────
│Product │    ✓  ✓  
│        │
├────────┤
│Architect
│        │    ✓  ✓  ✓
├────────┤
│Data    │       ✓  ✓  ✓
│        │
├────────┤
│Rules   │             ✓
│        │
├────────┤
│UX      │             ✓
│        │
├────────┤
│Frontend│       ✓  ✓  ✓
│        │
├────────┤
│QA      │       ✓  ✓  ✓
│        │
├────────┤
│Docs    │       ✓  ✓
│        │
├────────┤
│Deploy  │       ✓  ✓
│        │
└────────┘

✓ = Common handoff path
P=Product, A=Architect, D=Data, R=Rules, U=UX, F=Frontend, Q=QA, C=Docs, V=Deploy
```

## Resource Utilization

### Without Parallelization
```
Timeline: ████████████████████████████████████ (sequential)

Agent 1  ███████
Agent 2        ███████
Agent 3               ████████
...

Duration: ~400 minutes
```

### With spawnSubagent Parallelization
```
Timeline: ████████████████████████████████ (much shorter)

Agent 1  ███████
Agent 2  │ ███│ ███
Agent 3  │     ████
Agent 4  │     ████
Agent 5  │     ████
...

Duration: ~330 minutes (saves 70 minutes!)
```

## Context Flow Visualization

```
Product Agent Output
        │
        ├─ Rules: [R1, R2, R3, ...]
        ├─ Stories: [S1, S2, ...]
        └─ Edge Cases: [E1, E2, ...]
        │
        ▼ (passed as context)
Architect
        │
        ├─ Architecture Design
        ├─ Module Boundaries
        └─ Tech Stack
        │
        ├─────────────────────┬────────────────────┐
        │                     │                    │
        ▼                     ▼                    ▼
    Data Model        Rules Engine        UX Design
        │                   │                    │
        ├─ Entities         ├─ Rules Code       └─ Wireframes
        ├─ Schema           ├─ Tests            └─ Flows
        └─ Constraints      └─ Coverage
        │
        └──────────┬────────────────────┬──────────┘
                   │                    │
                   ▼                    ▼
           Frontend Implementation   Deployment
                   │                    │
                   ├─ Components        ├─ CI/CD
                   ├─ State Mgmt        ├─ Build Scripts
                   └─ Integration       └─ Monitoring
                   │
                   └──────────┬──────────┘
                              │
                              ▼
                        QA Testing
                              │
                              ├─ Unit Tests
                              ├─ Integration Tests
                              ├─ E2E Tests
                              └─ Coverage Report
                              │
                              ▼
                        Documentation
                              │
                              ├─ User Guides
                              ├─ Technical Docs
                              ├─ API Reference
                              └─ Troubleshooting
```

---

**Legend**: 
- → = Data flow
- ▼ = Sequential step
- ├ = Parallel branches
- ✓ = Common handoff

**See also**: [README.md](README.md), [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md), [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)
