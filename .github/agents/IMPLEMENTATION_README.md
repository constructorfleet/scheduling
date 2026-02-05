# Spawn Subagent Implementation Files

This directory contains the complete working implementation of the spawn subagent system. These files provide everything you need to run agents that delegate work to each other.

## 📁 Implementation Files

### 1. **spawnSubagent.ts** (Core Implementation - 500+ lines)
The main implementation providing:
- **SpawnSubagentManager** - Central coordination hub for all agent spawning
- **Request/Response Types** - Structured interfaces for type safety
- **Validation** - AJV-based request validation using JSON schema
- **Error Handling** - 6 error codes with recovery strategies
- **Metrics Tracking** - Execution statistics and performance metrics
- **Timeout Management** - Configurable timeouts per agent
- **Concurrency Control** - Max concurrent tasks per agent
- **Context Passing** - Size-limited context between agents
- **Logging** - Pluggable logger interface

**Key Exports:**
```typescript
export class SpawnSubagentManager
export async function spawnSubagent(request): Promise<SubagentResponse>
export async function spawnSubagentAsync(request): Promise<string>
export function initializeSpawnSubagent(logger?): SpawnSubagentManager
export class ConsoleLogger implements Logger
export class AgentExecutorFactory
```

### 2. **spawnSubagent.examples.ts** (Usage Examples - 600+ lines)
10 complete, runnable examples showing:
- Basic setup and initialization
- Simple agent handoffs
- Parallel execution patterns
- Chained/sequential workflows
- Error handling with retry
- Async fire-and-forget execution
- Metrics monitoring
- Integration tests
- Full project orchestration

**Run Examples:**
```bash
# Set EXAMPLE environment variable
EXAMPLE=basic-setup npm run examples
EXAMPLE=parallel npm run examples
EXAMPLE=full-project npm run examples
```

### 3. **spawnSubagent.integration.ts** (Agent Integration - 700+ lines)
Complete integration patterns for all 9 agents:
- **BaseAgent** - Template showing the integration pattern
- **ProductDomainAgentImpl** - Product domain agent implementation
- **SolutionArchitectAgentImpl** - Architecture design agent
- **DataModelAgentImpl** - Data model agent
- **RulesEngineAgentImpl** - Rules engine agent
- **SchedulingUXAgentImpl** - UX/UI design agent
- **FrontendEngineeringAgentImpl** - Frontend implementation
- **QATestingAgentImpl** - QA and testing agent
- **DocumentationAgentImpl** - Documentation agent
- **DeploymentOpsAgentImpl** - Deployment operations agent

**Plus:**
- Full project orchestration function
- Agent handoff map showing dependencies
- Integration test patterns

## 🚀 Quick Start

### Step 1: Initialize the System
```typescript
import { initializeSpawnSubagent, ConsoleLogger } from './spawnSubagent';

const manager = initializeSpawnSubagent(new ConsoleLogger());
```

### Step 2: Register Agents
```typescript
manager.registerAgents([
  {
    id: 'data-model-agent',
    name: 'Data Model Agent',
    description: 'Designs core data model',
    executor: async (request) => { /* implementation */ },
    timeoutMinutes: 30,
  },
  // ... more agents
]);
```

### Step 3: Spawn an Agent
```typescript
import { spawnSubagent } from './spawnSubagent';

const response = await spawnSubagent({
  targetAgent: 'data-model-agent',
  task: 'Design database schema',
  prompt: 'Create TypeScript interfaces for all entities...',
  context: { requirements: { ... } },
  timeoutMinutes: 30,
});

console.log(response.status); // 'completed', 'failed', 'timeout'
console.log(response.result); // Agent output
```

## 📋 Implementation Architecture

```
┌─────────────────────────────────────────┐
│  Calling Code / Main Application        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  spawnSubagent() / SpawnSubagentManager │
├─────────────────────────────────────────┤
│ • Request Validation (AJV)              │
│ • Agent Registry Lookup                 │
│ • Concurrency Checking                  │
│ • Context Size Validation               │
└────────────┬──────────────────┬─────────┘
             │                  │
      ┌──────▼──────┐    ┌──────▼──────┐
      │  Executor   │    │  Metrics    │
      │  + Timeout  │    │  Tracker    │
      └──────┬──────┘    └─────────────┘
             │
             ▼
    ┌─────────────────┐
    │  Agent Handler  │
    │  (Actual Logic) │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Response       │
    │  (Structured)   │
    └─────────────────┘
```

## 🔧 Configuration

### Agent Registration Options
```typescript
interface AgentMetadata {
  id: string;                              // Unique identifier
  name: string;                            // Human-readable name
  description: string;                     // What the agent does
  executor: (req) => Promise<Response>;   // The agent function
  maxConcurrent?: number;                 // Max parallel tasks (default 1)
  timeoutMinutes?: number;                // Default timeout (default 30)
  requiredContext?: string[];             // Expected context fields
}
```

### Spawn Request Options
```typescript
interface SpawnSubagentRequest {
  targetAgent: string;                    // Which agent to spawn
  task: string;                           // Task description
  prompt: string;                         // Agent instructions
  context?: Record<string, any>;          // Context data (max 10MB)
  expectedOutputFormat?: string;          // Optional format spec
  timeoutMinutes?: number;                // Override default timeout
  priority?: 'low' | 'normal' | 'high';  // Execution priority
  retryOnFailure?: boolean;               // Auto-retry on failure
}
```

## 📊 Monitoring & Metrics

Get execution metrics:
```typescript
const manager = getSpawnSubagentManager();
const metrics = manager.getMetrics();

console.log(metrics.totalSpawns);           // Total spawn calls
console.log(metrics.successCount);          // Successful completions
console.log(metrics.averageDuration);       // Avg time per spawn
console.log(metrics.agentStats);            // Per-agent statistics
```

Output example:
```
{
  totalSpawns: 25,
  successCount: 23,
  failureCount: 2,
  timeoutCount: 0,
  averageDuration: 12.5,
  agentStats: {
    'data-model-agent': {
      calls: 5,
      successes: 5,
      failures: 0,
      averageDuration: 8.2
    }
  }
}
```

## ⚠️ Error Handling

Six error codes for different failure modes:

| Error Code | Cause | Recovery |
|-----------|-------|----------|
| INVALID_REQUEST | Request validation failed | Check request format |
| AGENT_NOT_FOUND | Agent not registered | Register agent first |
| AGENT_BUSY | Too many concurrent tasks | Queue or retry later |
| TIMEOUT | Exceeded max time | Increase timeoutMinutes |
| CONTEXT_OVERFLOW | Context > 10MB | Reduce context size |
| EXECUTION_FAILED | Agent threw error | Check agent implementation |

Example error handling:
```typescript
try {
  const response = await spawnSubagent({
    targetAgent: 'data-model-agent',
    task: 'Design model',
    prompt: 'Create the schema...',
  });

  if (response.status === 'failed') {
    console.error('Agent failed:', response.errors);
  } else if (response.status === 'timeout') {
    console.error('Agent timed out');
  } else {
    console.log('Success:', response.result);
  }
} catch (error) {
  if (error instanceof SubagentError) {
    console.error(`Error ${error.code}: ${error.message}`);
  }
}
```

## 🧪 Testing Integration

### Unit Testing Agents
```typescript
import { AgentExecutorFactory } from './spawnSubagent';

// Mock agent for testing
const mockAgent = AgentExecutorFactory.createMockExecutor('test-agent', 500);

// Failing agent for error testing
const failingAgent = AgentExecutorFactory.createFailingExecutor('test-agent');
```

### Integration Testing
See `spawnSubagent.examples.ts` for complete integration test examples.

## 📖 API Reference

### SpawnSubagentManager Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `registerAgent(metadata)` | Register single agent | void |
| `registerAgents(list)` | Register multiple agents | void |
| `spawn(request)` | Spawn and wait for result | Promise<SubagentResponse> |
| `spawnAsync(request)` | Spawn without waiting | Promise<string> |
| `getAsyncResult(taskId)` | Get result of async task | Promise<SubagentResponse \| null> |
| `getMetrics()` | Get execution metrics | ExecutionMetrics |

### Global Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `spawnSubagent(request)` | Spawn using global manager | Promise<SubagentResponse> |
| `spawnSubagentAsync(request)` | Async spawn globally | Promise<string> |
| `initializeSpawnSubagent(logger?)` | Initialize global manager | SpawnSubagentManager |
| `getSpawnSubagentManager()` | Get global manager instance | SpawnSubagentManager |

## 🛠️ Troubleshooting

### "Agent not found"
- **Issue**: Spawn request for non-existent agent
- **Solution**: Register agent using `manager.registerAgent()` first

### "Agent is at maximum concurrency"
- **Issue**: Too many concurrent tasks for this agent
- **Solution**: Increase `maxConcurrent` or queue the request

### "Context size exceeds limit"
- **Issue**: Context data > 10MB
- **Solution**: Reduce context size or split into multiple requests

### "Timeout exceeded"
- **Issue**: Agent took too long
- **Solution**: Increase `timeoutMinutes` or optimize agent implementation

## 📚 Related Documentation

- [SUBAGENT_TOOL.md](./SUBAGENT_TOOL.md) - Complete tool specification
- [ORCHESTRATION_GUIDE.md](./ORCHESTRATION_GUIDE.md) - Project coordination patterns
- [README.md](./README.md) - System overview
- [VISUAL_GUIDE.md](./VISUAL_GUIDE.md) - Architecture diagrams

## 🔗 Integration Checklist

- [x] **Core implementation** (spawnSubagent.ts)
- [x] **Usage examples** (spawnSubagent.examples.ts)
- [x] **Agent integration** (spawnSubagent.integration.ts)
- [x] **Type definitions** (Request, Response interfaces)
- [x] **Error handling** (6 error codes + recovery)
- [x] **Metrics tracking** (execution statistics)
- [x] **Validation** (JSON schema + custom checks)
- [x] **Logging** (pluggable logger)
- [x] **Timeout management** (per-agent and per-request)
- [x] **Concurrency control** (max concurrent per agent)

## 📝 Next Steps

1. **Import** the core module: `import { spawnSubagent } from './spawnSubagent'`
2. **Initialize** the system: `initializeSpawnSubagent()`
3. **Register** your agents: `manager.registerAgents([...])`
4. **Spawn** agents: `await spawnSubagent({...})`
5. **Monitor** metrics: `manager.getMetrics()`

## ✅ Status

**Implementation Complete** ✅
- Core manager: Fully implemented
- Request/response types: Complete with validation
- Error handling: All 6 error codes
- Metrics: Full tracking implemented
- Examples: 10 different usage patterns
- Integration: All 9 agents covered
- Documentation: Complete with API reference

**Ready for Production**: YES

---

**Version**: 1.0.0  
**Date**: February 4, 2026  
**Status**: ✅ Complete & Tested
