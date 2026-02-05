# Scheduling Project Agents

A comprehensive multi-agent system for building a daycare scheduling application. Each specialized agent owns a specific domain and can hand off work to other agents using the `spawnSubagent` tool.

## 📋 Quick Navigation

### Core Documentation
- **[SUBAGENT_TOOL.md](SUBAGENT_TOOL.md)** - How to use the spawn subagent tool
- **[ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)** - How to coordinate agents through a project
- **[Agent Registry](#agent-registry)** - All available agents and their capabilities

### Individual Agents
1. [Product & Domain Agent](product-domain-agent.agent.md)
2. [Solution Architect Agent](solution-architect-agent.agent.md)
3. [Data Model Agent](data-model-agent.agent.md)
4. [Rules Engine Agent](rules-engine-agent.agent.md)
5. [Scheduling UX Agent](scheduling-ux-agent.agent.md)
6. [Frontend Engineering Agent](frontend-engineering-agent.agent.md)
7. [QA & Testing Agent](qa-testing-agent.agent.md)
8. [Documentation Agent](documentation-agent.agent.md)
9. [Deployment & Ops Agent](deployment-ops-agent.agent.md)

## 🎯 What is This?

This is a specialized agent architecture for building the scheduling application. Rather than one general-purpose AI, we have 9 focused agents, each expert in their domain:

- **Product & Domain Agent**: Translates business requirements into testable specifications
- **Solution Architect Agent**: Designs the overall system architecture
- **Data Model Agent**: Designs the database schema and entities
- **Rules Engine Agent**: Implements compliance rule evaluation
- **Scheduling UX Agent**: Designs the user interface and workflows
- **Frontend Engineering Agent**: Builds the UI implementation
- **QA & Testing Agent**: Creates comprehensive test suites
- **Documentation Agent**: Produces user and technical guides
- **Deployment & Ops Agent**: Sets up the build and deployment pipeline

## 🚀 Getting Started

### Option 1: Spawn a Single Agent

Ask a specific agent to do work:

```
I need the Product & Domain Agent to discover compliance requirements for daycare scheduling.
Key requirements:
- Staffing ratios
- Certification requirements
- Break and shift rules
- Compliance edge cases

Please produce a rules catalog and user stories.
```

### Option 2: Run the Full Project

Use the `spawnSubagent` tool to coordinate all agents through the project lifecycle:

```typescript
const orchestrator = new SchedulingProjectOrchestrator();
await orchestrator.runFullProject();
```

This will:
1. ✅ **Phase 1**: Discover compliance requirements (Product Agent)
2. ✅ **Phase 2**: Design architecture and data model (Architect + Data agents)
3. ✅ **Phase 3**: Implement rules, UI, and deployment (3 agents in parallel)
4. ✅ **Phase 4**: Create comprehensive tests (QA Agent)
5. ✅ **Phase 5**: Document and prepare for launch (Documentation + Deployment agents)

See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for detailed examples.

## 📊 Agent Registry

| Agent | Best For | Output |
|-------|----------|--------|
| **Product & Domain** | Requirements, rules, workflows | Rules catalog, user stories, edge cases |
| **Solution Architect** | Architecture, tech decisions | Architecture doc, module boundaries, tech stack |
| **Data Model** | Entity design, schema | Entity definitions, relationships, validation |
| **Rules Engine** | Rule implementation, compliance | Rules code, unit tests, 100% coverage |
| **Scheduling UX** | UI flows, interaction design | Wireframes, component specs, user flows |
| **Frontend Engineering** | UI implementation, components | React/Vue code, state management, tests |
| **QA & Testing** | Test strategy, test suites | Unit, integration, E2E tests, coverage report |
| **Documentation** | User guides, technical docs | User guides, API docs, runbooks, tutorials |
| **Deployment & Ops** | Build pipeline, DevOps | CI/CD workflow, deployment scripts, monitoring |

## 🔄 Common Workflows

### Workflow 1: Gather Requirements
```
Product & Domain Agent
  → Rules Catalog (20+ rules)
  → User Stories
  → Edge Cases
  → Success Metrics
```

### Workflow 2: Design Everything
```
Product + Requirements
  ↓
Solution Architect (architecture)  +  Data Model Agent (schema)
  ↓
(Both feed into implementation agents)
```

### Workflow 3: Build the App (Parallel)
```
Rules Engine Agent (rules + tests)
UI Agent (design) → Frontend Agent (implementation)
Deployment Agent (CI/CD setup)
(All 3 work simultaneously)
```

### Workflow 4: Prepare for Launch
```
Frontend Complete + Rules Complete
  ↓
QA Agent (comprehensive tests)
  ↓
Documentation Agent (user guides + technical docs)
  ↓
Deployment Agent (production pipeline)
```

## 🛠️ Using spawnSubagent

The `spawnSubagent` tool allows any agent to delegate work to another agent:

```typescript
const response = await spawnSubagent({
  targetAgent: 'rules-engine-agent',           // Which agent to spawn
  task: 'Implement ratio rules',               // Short task name
  prompt: `Detailed instructions...`,          // Full task description
  context: { requirements, design },           // Previous work to reference
  expectedOutputFormat: `{...}`,               // Expected return format
  timeoutMinutes: 60,                          // How long to wait
});

// Check response
if (response.status === 'completed') {
  const result = response.result;  // Structured result
  const summary = response.summary;
} else if (response.status === 'timeout') {
  // Task took too long
} else if (response.status === 'failed') {
  const errors = response.errors;
}
```

Full documentation: [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md)

## 🎓 Tips for Success

### 1. Be Specific
**❌ Bad**: "Build the UI"
**✅ Good**: "Build the ScheduleGrid component that shows staff (rows) and time blocks (columns) with staff assignments. Support drag-to-assign staff, click to remove, and show green/yellow/red status indicators for compliance."

### 2. Provide Context
Pass relevant prior work so the agent doesn't need to search:
```typescript
const response = await spawnSubagent({
  targetAgent: 'rules-engine-agent',
  context: {
    requirements: discoveredRules,      // From Product Agent
    architecture: designDoc,              // From Architect
    dataModel: entities,                  // From Data Model Agent
  },
  prompt: 'Using this context...'
});
```

### 3. Handle Failures
Always check the response status:
```typescript
if (response.status === 'completed') {
  // Success
} else if (response.status === 'timeout') {
  // Retry with longer timeout
  await retryWithLongerTimeout();
} else if (response.status === 'failed') {
  // Handle error, maybe try different approach
}
```

### 4. Parallelize When Possible
```typescript
// Parallel (all 3 work simultaneously):
const [rules, ui, deployment] = await Promise.all([
  spawnSubagent({ targetAgent: 'rules-engine-agent', ... }),
  spawnSubagent({ targetAgent: 'frontend-engineering-agent', ... }),
  spawnSubagent({ targetAgent: 'deployment-ops-agent', ... }),
]);
```

### 5. Chain Agents Logically
```
Product discovers rules
  → Architect designs solution based on rules
    → Multiple agents implement in parallel
      → QA tests everything
        → Documentation documents what was built
          → Deployment prepares for launch
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | This file - overview and quick start |
| `SUBAGENT_TOOL.md` | Complete documentation of the spawnSubagent tool |
| `ORCHESTRATION_GUIDE.md` | How to coordinate agents through a full project |
| `product-domain-agent.agent.md` | Requirements and domain specification agent |
| `solution-architect-agent.agent.md` | Architecture and design agent |
| `data-model-agent.agent.md` | Data model and schema design agent |
| `rules-engine-agent.agent.md` | Compliance rules implementation agent |
| `scheduling-ux-agent.agent.md` | UI/UX design agent |
| `frontend-engineering-agent.agent.md` | Frontend implementation agent |
| `qa-testing-agent.agent.md` | Testing and QA agent |
| `documentation-agent.agent.md` | Documentation and guides agent |
| `deployment-ops-agent.agent.md` | DevOps and deployment agent |

## 🎬 Example: Running the Full Project

```typescript
// Create orchestrator
const pm = new SchedulingProjectOrchestrator();

// Run all phases
const result = await pm.runFullProject();

// Result contains:
// - requirements: Rules, user stories, edge cases
// - design: Architecture + data model
// - implementation: Rules engine, UI, deployment pipeline
// - testing: Test plan, test suites, coverage report
// - launch: User guides, technical docs, deployment scripts
```

See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for the complete example.

## 🔍 Troubleshooting

### Agent Not Found
```
Error: AGENT_NOT_FOUND
```
**Solution**: Check the agent name in the [Agent Registry](#agent-registry)

### Prompt Too Vague
```
Error: INVALID_PROMPT
```
**Solution**: Provide more specific instructions and examples

### Task Timed Out
```
Error: TIMEOUT
```
**Solution**: Increase `timeoutMinutes` or break task into smaller pieces

### Context Overflow
```
Error: CONTEXT_OVERFLOW
```
**Solution**: Pass file paths instead of full content, or summarize context

## 📞 Support

Each agent has specific guidance in its documentation file. For example:
- Questions about compliance? See [Product & Domain Agent](product-domain-agent.agent.md)
- Architecture questions? See [Solution Architect Agent](solution-architect-agent.agent.md)
- Need to build the UI? See [Frontend Engineering Agent](frontend-engineering-agent.agent.md)

## 🎯 Success Metrics

You'll know the agent system is working when:
- ✅ Requirements are discovered and formalized
- ✅ Architecture is designed and agreed upon
- ✅ All components are implemented with high quality
- ✅ Comprehensive tests are passing (>90% coverage)
- ✅ User documentation is complete and clear
- ✅ Deployment pipeline is automated and reliable
- ✅ New users can complete tasks without training

## 📈 Scaling This Approach

This agent system can be scaled to larger projects by:
1. **Adding more specialized agents** (e.g., Security Agent, Performance Agent)
2. **Creating sub-agents** (e.g., UI agents for different modules)
3. **Defining agent teams** (Product team with multiple agents)
4. **Using feedback loops** (agents review each other's work)

See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for advanced patterns.
