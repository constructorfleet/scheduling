# Spawn Subagent Tool - Summary & Implementation Guide

## Overview

The **spawnSubagent** tool enables agents to delegate work to other specialized agents and receive structured results. This creates a flexible, scalable multi-agent system where:

- ✅ Each agent focuses on their domain of expertise
- ✅ Agents can hand off work to other agents when appropriate
- ✅ Complex projects can be broken into parallel and sequential phases
- ✅ Results flow between agents through structured data
- ✅ The system is self-organizing (agents know who to hand off to)

## What Makes This Different

### Traditional Single-Agent Approach
```
One AI tries to do everything:
- Requirements gathering
- Architecture design
- Frontend code
- Backend code
- Tests
- Documentation
- DevOps

❌ Result: Generalist AI spreads thin, loses focus, quality suffers
```

### Multi-Agent Approach (This System)
```
9 specialized agents, each expert in their domain:

Product Agent → Architect → Data Model → Rules Engine → QA → Docs → Deployment
   (rules)     (design)      (schema)      (tests)    (verify) (guide)  (launch)

✅ Result: Each agent deep-dives their specialty, high quality, parallelizable
```

## Key Features

### 1. **Structured Handoff**
```typescript
const response = await spawnSubagent({
  targetAgent: 'rules-engine-agent',
  task: 'Implement ratio rules',
  prompt: 'Implement staffing ratios with tests...',
  context: { dataModel, requirements },
  expectedOutputFormat: '{ rules: Array, coverage: number }',
  timeoutMinutes: 90
});
```

### 2. **Parallel Execution**
```typescript
// All 3 work at the same time
const [rules, ui, ops] = await Promise.all([
  spawnSubagent({ targetAgent: 'rules-engine-agent', ... }),
  spawnSubagent({ targetAgent: 'scheduling-ux-agent', ... }),
  spawnSubagent({ targetAgent: 'deployment-ops-agent', ... })
]);
// Time: ~30 minutes (instead of 90 if sequential)
```

### 3. **Context Passing**
```typescript
// Output from one agent becomes input to the next
const requirements = (await spawnSubagent({...})).result;
const architecture = (await spawnSubagent({
  context: { requirements }  // Pass it along
})).result;
```

### 4. **Error Recovery**
```typescript
if (response.status === 'timeout') {
  await retry({ timeoutMinutes: 120 });  // Longer timeout
} else if (response.status === 'failed') {
  const errors = response.errors;  // Actionable errors
  // Handle or escalate
}
```

## Tool Specification

### Request Format
```typescript
interface SpawnSubagentRequest {
  targetAgent: string;              // Required: agent ID
  task: string;                     // Required: task name
  prompt: string;                   // Required: detailed instructions
  context?: Record<string, any>;    // Optional: prior work
  expectedOutputFormat?: string;    // Optional: desired return structure
  timeoutMinutes?: number;          // Optional: max 480 (default 30)
}
```

### Response Format
```typescript
interface SubagentResponse {
  agentName: string;
  taskId: string;
  status: 'completed' | 'failed' | 'timeout';
  result: any;                      // Structured output
  summary: string;                  // 1-2 sentence summary
  artifacts: {
    filePath?: string;
    data?: any;
    url?: string;
  };
  executedAt: string;               // ISO8601 timestamp
  durationSeconds: number;
  errors?: string[];                // If failed
}
```

### Agent Registry
| Agent | ID | Domain |
|-------|----|----|
| Product & Domain | `product-domain-agent` | Requirements, rules, user stories |
| Solution Architect | `solution-architect-agent` | Architecture, tech stack, design |
| Data Model | `data-model-agent` | Entities, schema, relationships |
| Rules Engine | `rules-engine-agent` | Compliance rules, validation |
| Scheduling UX | `scheduling-ux-agent` | UI design, workflows, wireframes |
| Frontend Engineering | `frontend-engineering-agent` | React/Vue, components, state |
| QA & Testing | `qa-testing-agent` | Tests, coverage, quality |
| Documentation | `documentation-agent` | Guides, docs, tutorials |
| Deployment & Ops | `deployment-ops-agent` | CI/CD, build, deployment |

## Implementation Checklist

- [x] **Tool Definition** → `SUBAGENT_TOOL.md` (complete specification)
- [x] **Tool Schema** → `spawnSubagent.schema.json` (JSON schema for validation)
- [x] **Orchestration Guide** → `ORCHESTRATION_GUIDE.md` (how to coordinate)
- [x] **Agent Updates** → All 9 agents now include `spawnSubagent` tool
- [x] **Handoff Configuration** → Each agent knows who to hand off to
- [x] **README** → `README.md` (quick start and overview)

## Usage Patterns

### Pattern 1: Sequential Phases
```
Phase 1: Product discovers requirements
   ↓
Phase 2: Architect designs solution
   ↓
Phase 3: Multiple agents implement (parallel)
   ↓
Phase 4: QA tests everything
   ↓
Phase 5: Documentation + Deployment
```

### Pattern 2: Parallel Execution
```
Rules Engine Agent  ─┐
UI Agent           ─┼─ Execute simultaneously
Deployment Agent   ─┘
```

### Pattern 3: Context Chain
```
Requirements → Architecture → Data Model → Implementation
     ↓              ↓              ↓
  context[0]    context[1]    context[2]
```

## Common Use Cases

### Use Case 1: Full Project Orchestration
```typescript
const orchestrator = new ProjectOrchestrator();
const result = await orchestrator.runFullProject();
// Automatically coordinates all 9 agents through phases
```

### Use Case 2: Specific Task Delegation
```typescript
// Product manager needs rules from an expert
await spawnSubagent({
  targetAgent: 'product-domain-agent',
  task: 'Extract compliance requirements',
  prompt: '...'
});
```

### Use Case 3: Parallel Work
```typescript
// Three critical path items, work simultaneously
await Promise.all([
  spawnSubagent({ targetAgent: 'rules-engine-agent', ... }),
  spawnSubagent({ targetAgent: 'scheduling-ux-agent', ... }),
  spawnSubagent({ targetAgent: 'deployment-ops-agent', ... })
]);
```

### Use Case 4: Iterative Refinement
```typescript
// V1: Initial design
let design = (await spawnSubagent({
  targetAgent: 'scheduling-ux-agent',
  task: 'Design UI v1',
  prompt: '...'
})).result;

// V2: Refine based on feedback
design = (await spawnSubagent({
  targetAgent: 'scheduling-ux-agent',
  task: 'Refine UI based on feedback',
  context: { previousDesign: design, feedback: 'Make violations more prominent' },
  prompt: '...'
})).result;
```

## Benefits

### For Project Management
- ✅ Clear task distribution
- ✅ Parallel execution reduces timeline
- ✅ Structured handoffs prevent miscommunication
- ✅ Metrics and tracking built-in

### For Quality
- ✅ Each agent is a domain expert
- ✅ Deep focus on specific areas
- ✅ Testable outputs at each stage
- ✅ Easy to validate and review

### For Scalability
- ✅ Add more agents for larger projects
- ✅ Create specialized sub-agents (e.g., FrontendAuthAgent)
- ✅ Reuse agents across projects
- ✅ Extend without breaking existing flow

### For Maintainability
- ✅ Each agent's code is focused and testable
- ✅ Clear interfaces between agents
- ✅ Easy to replace or upgrade individual agents
- ✅ Audit trail of who did what when

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `AGENT_NOT_FOUND` | Invalid agent ID | Check agent registry |
| `INVALID_PROMPT` | Too vague or malformed | Add more detail |
| `TIMEOUT` | Task took too long | Increase timeout or break up |
| `CONTEXT_OVERFLOW` | Context too large | Use file paths instead |
| `VALIDATION_ERROR` | Output doesn't match format | Clarify expectedOutputFormat |

## Files Included

```
.github/agents/
├── README.md                          # Quick start and overview
├── SUBAGENT_TOOL.md                   # Complete tool documentation
├── ORCHESTRATION_GUIDE.md             # How to coordinate agents
├── spawnSubagent.schema.json          # JSON schema for validation
├── product-domain-agent.agent.md      # Agent 1
├── solution-architect-agent.agent.md  # Agent 2
├── data-model-agent.agent.md          # Agent 3
├── rules-engine-agent.agent.md        # Agent 4
├── scheduling-ux-agent.agent.md       # Agent 5
├── frontend-engineering-agent.agent.md # Agent 6
├── qa-testing-agent.agent.md          # Agent 7
├── documentation-agent.agent.md       # Agent 8
├── deployment-ops-agent.agent.md      # Agent 9
└── SPAWN_SUBAGENT_SUMMARY.md          # This file
```

## Getting Started

### Step 1: Understand the Tool
Read [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md) for complete specification

### Step 2: See Examples
Check [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for real examples

### Step 3: Pick an Agent
Select from [README.md](README.md) agent registry

### Step 4: Spawn It
```typescript
await spawnSubagent({
  targetAgent: 'agent-id',
  task: 'Your task',
  prompt: 'Detailed instructions...'
});
```

### Step 5: Handle Response
```typescript
if (response.status === 'completed') {
  useResult(response.result);
} else {
  handleError(response.errors);
}
```

## Next Steps

1. **Try a single agent**: Spawn Product Agent to gather requirements
2. **Try parallel agents**: Spawn 3 agents at once for different components
3. **Run full project**: Use the ProjectOrchestrator to run all 9 agents

See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for detailed code examples and [README.md](README.md) for quick reference.

---

**Status**: ✅ Complete and ready to use

**Version**: 1.0.0

**Last Updated**: February 4, 2026
