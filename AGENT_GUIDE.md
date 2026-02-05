# Agent System - Quick Reference

## Overview

The scheduling project uses a 9-agent orchestration system where each agent specializes in one phase of development, loading specifications from markdown files and passing results to downstream agents.

## Phase Flow

```
Product & Domain Agent
        ↓
Solution Architect Agent
        ↓ (parallel)
    ├─ Data Model Agent
    │       ↓
    │   Rules Engine Agent
    │       ↓
    │   QA & Testing Agent
    │
    └─ Deployment & Ops Agent
        
Scheduling UX Agent
        ↓
Frontend Engineering Agent
        ↓
    QA & Testing Agent (again)
    
Documentation Agent
        ↓
    Deployment & Ops Agent (again)
```

## Running Orchestration

### Option 1: Full Orchestration (All 9 Agents)

```bash
npm run orchestrate
```

This runs all agents in sequence and saves results to:
```
artifacts/orchestration-results-2026-02-04T12-34-56-789Z.json
```

### Option 2: Individual Agent Testing

```typescript
import { ProductDomainAgentImpl } from './.github/agents/spawnSubagent.integration';

const agent = new ProductDomainAgentImpl();
const result = await agent.execute('Analyze requirements for daycare scheduling');
console.log(result);
```

### Option 3: Agent with Custom Context

```typescript
import { DataModelAgentImpl } from './.github/agents/spawnSubagent.integration';
import { getProjectContext } from './.github/agents/spawnSubagent.integration';

const projectCtx = await getProjectContext();
const agent = new DataModelAgentImpl();
const result = await agent.execute(
  'Design the data model',
  { 
    requirements: projectCtx,
    previousPhaseOutput: {...}
  }
);
```

## Customizing Agent Behavior

### Update Agent Specifications

Edit `AGENTS.md` to change agent purpose, inputs, outputs, or definition of done:

```markdown
### 1) Product & Domain Agent
**Purpose:** Translate daycare policies and scheduling needs into precise requirements.
- Inputs: district policy docs, director interviews
- Outputs: rules catalog, user stories, edge-cases
- DoD: rules are unambiguous and testable
```

### Set AI Provider

```typescript
import { setAIProvider, OpenAIProvider } from './.github/agents/spawnSubagent';

setAIProvider(new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
}));
```

### Configure Context Compression

```typescript
import { setCompressionConfig } from './.github/agents/spawnSubagent';

setCompressionConfig({
  maxContextSizeInMB: 10,
  compressionThresholdPercent: 70,
  enableAutoCompression: true,
});
```

## Understanding Artifacts

Each orchestration run produces:

### orchestration-results-{timestamp}.json

```json
{
  "requirements": { ... },
  "architecture": { ... },
  "dataModel": { ... },
  "rulesEngine": { ... },
  "uiDesign": { ... },
  "frontend": { ... },
  "testing": { ... },
  "documentation": { ... },
  "deployment": { ... }
}
```

Extract specific phase output:

```bash
# View full results
cat artifacts/orchestration-results-*.json | jq .

# View just requirements
cat artifacts/orchestration-results-*.json | jq .requirements

# View architecture
cat artifacts/orchestration-results-*.json | jq .architecture
```

## Agent Output Expectations

### Product & Domain Agent Output

```typescript
{
  summary: string,           // AI analysis
  requirements: string,      // Structured requirements
  userStories: string[],     // User stories
  edgeCases: string[],       // Edge cases identified
}
```

### Solution Architect Output

```typescript
{
  summary: string,
  architecture: string,      // Architecture design
  techStack: string[],       // Technology decisions
  spawned: { ... }          // Downstream agent outputs
}
```

### Data Model Output

```typescript
{
  summary: string,
  dataModel: string,         // Entity definitions
  relationships: string,     // Entity relationships
  spawned: { ... }          // Rules engine results
}
```

*All agents follow similar pattern: summary + phase-specific data + spawned results*

## Debugging

### Enable Logging

Agents log to console by default:
```
[Product & Domain Agent] Executing: Analyze requirements...
[AUTO-COMPRESS] Context size 2.5MB exceeds threshold 7MB - compressing...
[CONTEXT COMPRESSION] 2.5MB → 1.2MB (52% reduction)
```

### Check Context Size

```typescript
import { getContextSize } from './.github/agents/spawnSubagent';

const size = getContextSize({ requirements: {...}, architecture: {...} });
console.log(`Context: ${size.toFixed(2)}MB`);
```

### Compress Context Manually

```typescript
import { compressContext } from './.github/agents/spawnSubagent';

const compressed = await compressContext(largeContext, 40);
```

## File Structure for Agent Outputs

Create phase-specific directories in `artifacts/`:

```
artifacts/
├── orchestration-results-2026-02-04T...json
├── phase-1-discovery/
│   ├── rules-catalog.md
│   ├── workflows.md
│   └── requirements.md
├── phase-2-architecture/
│   ├── architecture.txt
│   ├── tech-stack.md
│   └── modules.md
├── phase-3-data-model/
│   ├── entities.md
│   ├── relationships.md
│   └── schema.sql
├── ...
└── README.md
```

## Typical Workflow

1. **Review Specifications**
   ```bash
   cat AGENTS.md PROJECT.md DOMAIN_MODEL.md BACKLOG.md
   ```

2. **Run Full Orchestration**
   ```bash
   npm run orchestrate
   ```

3. **Review Results**
   ```bash
   cat artifacts/orchestration-results-*.json | jq .
   ```

4. **Extract Phase Outputs**
   ```bash
   jq '.requirements' artifacts/orchestration-results-*.json > artifacts/phase-1-discovery/requirements.md
   ```

5. **Approve and Iterate**
   - Update PROJECT.md or AGENTS.md if needed
   - Re-run orchestration
   - Compare results

---

For more details, see:
- `KICKOFF.md` - Project overview
- `PROJECT.md` - Project charter
- `AGENTS.md` - Agent specifications
- `BACKLOG.md` - User stories
