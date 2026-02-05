---
name: Spawn Subagent Tool
description: Allows agents to hand off work to other agents and receive structured results
version: 1.0
status: available
---

# Spawn Subagent Tool

This tool enables agents to delegate work to other specialized agents and receive structured results back. Use this when you need another agent's expertise or when work is better handled by a focused agent.

## Tool Signature

```typescript
interface SpawnSubagentRequest {
  targetAgent: string;           // Name of agent to spawn (see Agent Registry below)
  task: string;                  // Short title of the task
  prompt: string;                // Detailed task description (100-500 words)
  context?: Record<string, any>; // Optional context data to pass
  expectedOutputFormat?: string; // Describe the expected return format
  timeoutMinutes?: number;       // Max time to wait (default: 30)
}

interface SubagentResponse<T = any> {
  agentName: string;
  taskId: string;                // Unique ID for this task execution
  status: 'completed' | 'failed' | 'timeout';
  result: T;                     // Structured result matching expectedOutputFormat
  summary: string;               // 1-2 sentence summary of work done
  artifacts: {
    filePath?: string;           // If agent created files
    data?: any;                  // Raw data if applicable
    url?: string;                // Link to results if hosted
  };
  executedAt: string;            // ISO8601 timestamp
  durationSeconds: number;
  errors?: string[];             // If status is 'failed'
}
```

## Usage Pattern

```typescript
// Example: Product Agent spawning Data Model Agent
const response = await spawnSubagent({
  targetAgent: 'data-model-agent',
  task: 'Design staff certification data model',
  prompt: `
    Based on the compliance rules we've discovered, design the data model for 
    tracking staff certifications. Requirements:
    - Must support expiration dates with renewal alerts
    - Track multiple certifications per staff member
    - Support conditional requirements (e.g., "CPR required for field trip")
    
    Provide:
    1. Entity definition (attributes, types, constraints)
    2. Relationships to other entities
    3. Validation rules
    4. Query patterns we'll need
    5. Example JSON instances
  `,
  expectedOutputFormat: `
    {
      entity: string;
      attributes: Array<{ name, type, required, constraints }>;
      relationships: string[];
      validationRules: string[];
      queryPatterns: string[];
      examples: Array<JSON>;
    }
  `,
  timeoutMinutes: 15,
});

// Use the result
if (response.status === 'completed') {
  const certModel = response.result;
  console.log(`Staff entity attributes: ${certModel.attributes.map(a => a.name).join(', ')}`);
  
  // Incorporate into my work
  incorporateCertificationModel(certModel);
  
} else if (response.status === 'failed') {
  console.error(`Subagent failed: ${response.errors.join(', ')}`);
  // Handle error - maybe retry or escalate
}
```

## Agent Registry

| Agent Name | Agent ID | Best For |
|-----------|----------|----------|
| Product & Domain Agent | `product-domain-agent` | Requirements gathering, rule discovery, user stories, edge case analysis |
| Solution Architect Agent | `solution-architect-agent` | Architecture decisions, tech stack selection, module design |
| Data Model Agent | `data-model-agent` | Entity design, relationships, validation, schema |
| Rules Engine Agent | `rules-engine-agent` | Rule implementation, compliance logic, evaluation framework |
| Scheduling UX Agent | `scheduling-ux-agent` | UI flows, wireframes, interaction patterns, component specs |
| Frontend Engineering Agent | `frontend-engineering-agent` | UI implementation, state management, component code |
| QA & Testing Agent | `qa-testing-agent` | Test planning, test data, coverage strategy, test implementation |
| Documentation Agent | `documentation-agent` | User guides, technical docs, API reference, runbooks |
| Deployment & Ops Agent | `deployment-ops-agent` | Build pipeline, CI/CD setup, deployment strategy, monitoring |

## Common Handoff Scenarios

### Scenario 1: Product → Data Model
**When**: After finalizing compliance rules
**What to pass**: Rules catalog, user stories, workflows
**What to expect back**: Entity definitions, relationships, validation

```typescript
const dataModelResponse = await spawnSubagent({
  targetAgent: 'data-model-agent',
  task: 'Design complete data model',
  prompt: `
    Rules catalog: [INSERT RULES]
    User workflows: [INSERT WORKFLOWS]
    
    Design a normalized data model that supports all these rules and workflows.
  `,
});
```

### Scenario 2: Architect → Frontend Engineering
**When**: After finalizing architecture and tech stack
**What to pass**: Module boundaries, component specs, state structure
**What to expect back**: Working UI code, component library

```typescript
const frontendResponse = await spawnSubagent({
  targetAgent: 'frontend-engineering-agent',
  task: 'Implement scheduling grid component',
  prompt: `
    Component specification:
    ${componentSpec}
    
    State structure:
    ${stateDefinition}
    
    Implement the ScheduleGrid component with full functionality.
  `,
});
```

### Scenario 3: Rules Engine → QA & Testing
**When**: After implementing all rules
**What to pass**: Rule definitions, test cases, compliance scenarios
**What to expect back**: Test plan, test fixtures, coverage report

```typescript
const testingResponse = await spawnSubagent({
  targetAgent: 'qa-testing-agent',
  task: 'Create comprehensive rules test suite',
  prompt: `
    Rules implemented: [LIST RULES]
    
    Create unit tests for each rule with:
    - Happy path test cases
    - Edge cases
    - Violation detection tests
    
    Target: 100% coverage of rule logic
  `,
});
```

### Scenario 4: Frontend → QA & Testing
**When**: After UI is implemented
**What to pass**: Component code, workflows, acceptance criteria
**What to expect back**: E2E tests, integration tests

```typescript
const e2eResponse = await spawnSubagent({
  targetAgent: 'qa-testing-agent',
  task: 'Create E2E tests for schedule workflow',
  prompt: `
    Workflow: Create schedule → Assign staff → Resolve violations → Lock
    
    Create Cypress/Playwright tests covering:
    1. Happy path (compliant schedule)
    2. Violation handling
    3. Copy & modify workflow
    4. Edge cases
    
    Acceptance criteria: All workflows pass consistently
  `,
});
```

### Scenario 5: Development Team → Documentation
**When**: After MVP is complete
**What to pass**: Implemented features, UI screenshots, architecture docs
**What to expect back**: User guides, technical docs, video storyboards

```typescript
const docsResponse = await spawnSubagent({
  targetAgent: 'documentation-agent',
  task: 'Create user guide for schedule creation',
  prompt: `
    Feature: Weekly schedule creation with staff assignment
    
    Create step-by-step user guide with:
    - Screenshots of each step
    - Explanations for non-technical users
    - Common issues and solutions
    - Video storyboard outline
    
    Acceptance: 80% of new users can complete task without training
  `,
});
```

## Best Practices

### 1. Be Specific & Detailed
**Bad**: "Design the data model"
**Good**: "Design the data model for staff certifications with expiration tracking, supporting these specific compliance rules: [list rules]. Must support queries like [list queries]."

### 2. Include All Context
Pass relevant documents, specifications, or prior work so the agent doesn't need to search:
```typescript
await spawnSubagent({
  targetAgent: 'rules-engine-agent',
  task: 'Implement ratio rules',
  context: {
    rulesFromDiscovery: rulesDoc,        // Previously gathered rules
    dataModelDefinition: dataModel,      // From data model agent
    testFixtures: testData,              // Test data to use
    complianceScenarios: scenarios,      // From product agent
  },
  prompt: 'Using the provided context, implement the ratio validation rules...'
});
```

### 3. Define Expected Output Format
Be clear about what format you want back:
```typescript
expectedOutputFormat: `
  {
    rules: Array<{
      id: string;
      name: string;
      implementation: string;  // TypeScript function
      testCases: Array<{
        input: object;
        expectedOutput: string;
      }>;
    }>;
    totalRulesImplemented: number;
    coverage: number;  // percentage
  }
`
```

### 4. Handle Failures Gracefully
```typescript
const response = await spawnSubagent({ /* ... */ });

switch (response.status) {
  case 'completed':
    incorporateResults(response.result);
    break;
  
  case 'timeout':
    console.warn('Task timed out. Retrying with longer timeout...');
    retry({ timeoutMinutes: 60 });
    break;
  
  case 'failed':
    console.error(`Task failed: ${response.errors.join(', ')}`);
    // Escalate or fallback
    fallbackApproach();
    break;
}
```

### 5. Chain Agents for Complex Work
```typescript
// Step 1: Product gathers requirements
const requirements = await spawnSubagent({
  targetAgent: 'product-domain-agent',
  task: 'Discover compliance requirements',
  prompt: 'Interview directors and extract all compliance rules...'
});

// Step 2: Architect designs solution
const architecture = await spawnSubagent({
  targetAgent: 'solution-architect-agent',
  task: 'Design system architecture',
  context: { requirements: requirements.result },
  prompt: 'Given these requirements, design the overall architecture...'
});

// Step 3: Data Model Agent designs schema
const dataModel = await spawnSubagent({
  targetAgent: 'data-model-agent',
  task: 'Design data model',
  context: { 
    requirements: requirements.result,
    architecture: architecture.result 
  },
  prompt: 'Design the data model for this system...'
});

// And so on...
```

## Response Handling Examples

### Working with Artifacts
```typescript
const response = await spawnSubagent({
  targetAgent: 'frontend-engineering-agent',
  task: 'Create component library',
  // ...
});

if (response.artifacts.filePath) {
  // Agent created a file - incorporate it
  const code = readFile(response.artifacts.filePath);
  importComponentLibrary(code);
}
```

### Iterating on Results
```typescript
const v1 = await spawnSubagent({
  targetAgent: 'scheduling-ux-agent',
  task: 'Create initial wireframes',
  // ...
});

// Review and request changes
const v2 = await spawnSubagent({
  targetAgent: 'scheduling-ux-agent',
  task: 'Refine wireframes based on feedback',
  context: { 
    previousWireframes: v1.result,
    feedback: 'Make the violation panel more prominent'
  },
  // ...
});
```

### Parallel Subagent Calls
```typescript
// Spawn multiple agents in parallel
const [rulesResponse, uiResponse, dataResponse] = await Promise.all([
  spawnSubagent({
    targetAgent: 'rules-engine-agent',
    task: 'Implement ratio rules',
    // ...
  }),
  spawnSubagent({
    targetAgent: 'scheduling-ux-agent',
    task: 'Design schedule UI',
    // ...
  }),
  spawnSubagent({
    targetAgent: 'data-model-agent',
    task: 'Design data model',
    // ...
  })
]);

// All three agents work in parallel, faster completion
console.log('All components ready for integration');
```

## Limitations & Constraints

1. **No Real-Time Feedback**: Subagent work is async. Use callbacks for long-running tasks if needed.
2. **Context Size**: Pass only necessary context to avoid token waste. Use file paths instead of embedding large documents.
3. **Timeout**: Default 30 minutes. Complex tasks may need more time.
4. **Sequential Execution**: Agents execute one at a time. Spawn multiple agents for parallelism.
5. **No State Sharing**: Subagent doesn't have access to your full state. Pass what it needs explicitly.

## Error Codes & Recovery

| Code | Meaning | Recovery |
|------|---------|----------|
| `AGENT_NOT_FOUND` | Target agent doesn't exist | Check agent name in registry |
| `INVALID_PROMPT` | Prompt is malformed or too vague | Rewrite with more detail and context |
| `TIMEOUT` | Task took too long | Retry with longer timeout or split task |
| `CONTEXT_OVERFLOW` | Context too large | Pass file paths instead of full content |
| `AGENT_BUSY` | Agent is already processing a task | Retry after a delay or spawn different agent |
| `VALIDATION_ERROR` | Response doesn't match expected format | Review expectedOutputFormat and agent capability |

## Tool Integration in Your Agents

Each agent file includes a `tools` field that now includes this capability:

```yaml
tools: ['semantic_search', 'grep_search', 'read_file', 'run_in_terminal', 'spawnSubagent']
```

Agents use `spawnSubagent` to delegate work and maintain focus on their core responsibility.

## Example: Complete Workflow

```typescript
// === PROJECT MANAGER ORCHESTRATION ===

class SchedulingProjectManager {
  async executePhase1_Discovery() {
    // Phase 1: Requirements & Discovery
    const rulesResponse = await spawnSubagent({
      targetAgent: 'product-domain-agent',
      task: 'Formalize compliance rules',
      prompt: `
        From director interviews and policy documents, create:
        1. A rules catalog with 20-30 compliance rules
        2. User stories for core workflows
        3. Edge cases and constraint conflicts
        4. Success metrics
      `,
      timeoutMinutes: 60,
    });
    
    return rulesResponse.result;
  }

  async executePhase2_Architecture(requirements) {
    // Phase 2: Architecture & Tech Stack
    const [archResponse, dataResponse] = await Promise.all([
      spawnSubagent({
        targetAgent: 'solution-architect-agent',
        task: 'Design system architecture',
        context: { requirements },
        prompt: 'Design the overall architecture, module boundaries, and tech stack...',
      }),
      spawnSubagent({
        targetAgent: 'data-model-agent',
        task: 'Design data model',
        context: { requirements },
        prompt: 'Design the core data model that supports all requirements...',
      }),
    ]);
    
    return {
      architecture: archResponse.result,
      dataModel: dataResponse.result,
    };
  }

  async executePhase3_Implementation(architecture, dataModel) {
    // Phase 3: Build (parallel)
    const [rulesResponse, uiResponse, opsResponse] = await Promise.all([
      spawnSubagent({
        targetAgent: 'rules-engine-agent',
        task: 'Implement rules engine',
        context: { architecture, dataModel },
        prompt: 'Implement all compliance rules with 100% test coverage...',
      }),
      spawnSubagent({
        targetAgent: 'frontend-engineering-agent',
        task: 'Build scheduling UI',
        context: { architecture, dataModel },
        prompt: 'Build the complete scheduling UI with all workflows...',
      }),
      spawnSubagent({
        targetAgent: 'deployment-ops-agent',
        task: 'Setup CI/CD pipeline',
        context: { architecture },
        prompt: 'Design and implement the build and deployment pipeline...',
      }),
    ]);
    
    return {
      rulesEngine: rulesResponse.result,
      frontend: uiResponse.result,
      deploymentPipeline: opsResponse.result,
    };
  }

  async executePhase4_Quality(implementation) {
    // Phase 4: Testing & QA
    const testingResponse = await spawnSubagent({
      targetAgent: 'qa-testing-agent',
      task: 'Create comprehensive test suite',
      context: { implementation },
      prompt: 'Create unit, integration, and E2E tests covering all features...',
      timeoutMinutes: 90,
    });
    
    return testingResponse.result;
  }

  async executePhase5_Documentation(implementation) {
    // Phase 5: Documentation
    const docsResponse = await spawnSubagent({
      targetAgent: 'documentation-agent',
      task: 'Create user and technical guides',
      context: { implementation },
      prompt: 'Create comprehensive user guides and technical documentation...',
    });
    
    return docsResponse.result;
  }

  // Main orchestration
  async runFullProject() {
    console.log('🚀 Starting Scheduling App Project');
    
    const phase1 = await this.executePhase1_Discovery();
    console.log(`✅ Phase 1 complete: ${phase1.rulesCount} rules discovered`);
    
    const phase2 = await this.executePhase2_Architecture(phase1);
    console.log('✅ Phase 2 complete: Architecture and data model designed');
    
    const phase3 = await this.executePhase3_Implementation(phase2.architecture, phase2.dataModel);
    console.log('✅ Phase 3 complete: All components implemented');
    
    const phase4 = await this.executePhase4_Quality(phase3);
    console.log(`✅ Phase 4 complete: ${phase4.testCount} tests passing`);
    
    const phase5 = await this.executePhase5_Documentation(phase3);
    console.log('✅ Phase 5 complete: Documentation complete');
    
    console.log('🎉 Project complete and ready for deployment!');
  }
}
```

## Metrics & Monitoring

Track subagent performance for optimization:

```typescript
interface SubagentMetrics {
  agentName: string;
  taskCount: number;
  successRate: number;        // percentage
  avgDurationSeconds: number;
  avgTokensUsed: number;
  failureReasons: Record<string, number>;
  qualityScore: number;       // Based on follow-up iterations needed
}
```

Use these metrics to:
- Identify problematic agents or tasks
- Optimize parallelization strategy
- Estimate project timelines
- Allocate resources better
