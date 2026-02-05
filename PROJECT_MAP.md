# Project Map & Navigation

## Documents

### 📋 Core Project Documents
- **[README.md](README.md)** - Project overview and quick start
- **[KICKOFF.md](KICKOFF.md)** - Project kickoff guide with deliverables
- **[PROJECT.md](PROJECT.md)** - Detailed project charter and scope
- **[AGENTS.md](AGENTS.md)** - Agent specifications and responsibilities
- **[BACKLOG.md](BACKLOG.md)** - User stories and acceptance criteria
- **[DOMAIN_MODEL.md](DOMAIN_MODEL.md)** - Domain entities and relationships

### 🤖 Agent System
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** - How to run and customize agents
- **[orchestrate.ts](orchestrate.ts)** - Agent orchestration entry point
- **[.github/agents/](.github/agents/)** - Agent implementation
  - `spawnSubagent.ts` - Core orchestration framework
  - `spawnSubagent.integration.ts` - Agent implementations

### 📦 Artifacts & Outputs
- **[artifacts/README.md](artifacts/README.md)** - How to work with agent outputs
- **artifacts/orchestration-results-*.json** - Complete agent outputs
- **artifacts/phase-*-*/** - Phase-specific outputs (created during orchestration)

## Directory Structure

```
scheduling/
│
├── 📄 Documentation Layer
│   ├── README.md                    # Project overview
│   ├── KICKOFF.md                  # Kickoff guide
│   ├── PROJECT.md                  # Project charter
│   ├── AGENTS.md                   # Agent specs
│   ├── BACKLOG.md                  # User stories
│   ├── DOMAIN_MODEL.md             # Domain entities
│   ├── AGENT_GUIDE.md              # Agent system guide
│   └── PROJECT_MAP.md              # This file
│
├── 🤖 Agent System Layer
│   └── .github/agents/
│       ├── spawnSubagent.ts        # Core framework
│       └── spawnSubagent.integration.ts # Agent impls
│
├── 🏗️ Application Code Layer
│   └── src/
│       ├── domain/                 # Domain model (entities)
│       ├── rules/                  # Rules engine
│       ├── ui/                     # React components
│       ├── storage/                # Data persistence
│       └── index.ts                # App entry point
│
├── 🧪 Testing Layer
│   ├── tests/                      # Test suites
│   └── jest.config.ts              # Test configuration
│
├── 📦 Output & Artifacts
│   ├── artifacts/                  # Agent outputs
│   │   ├── orchestration-results-*.json
│   │   ├── phase-1-discovery/
│   │   ├── phase-2-architecture/
│   │   ├── phase-3-data-model/
│   │   ├── phase-4-rules-engine/
│   │   ├── phase-5-ux-design/
│   │   ├── phase-6-frontend/
│   │   ├── phase-7-qa/
│   │   ├── phase-8-documentation/
│   │   ├── phase-9-deployment/
│   │   └── README.md
│   └── dist/                       # Compiled output
│
├── ⚙️ Configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   └── .eslintrc.json
│
└── 🚀 Entry Points
    ├── orchestrate.ts              # Run agents
    └── src/index.ts                # Run app
```

## How to Navigate

### I want to understand the project scope
→ Read **[PROJECT.md](PROJECT.md)** (business overview)  
→ Read **[BACKLOG.md](BACKLOG.md)** (user stories)  

### I want to understand how it will be built
→ Read **[AGENTS.md](AGENTS.md)** (agent roles)  
→ Read **[AGENT_GUIDE.md](AGENT_GUIDE.md)** (how to run)  

### I want to run the agent orchestration
→ Follow **[KICKOFF.md](KICKOFF.md)** Step 2  
→ Run: `npm run orchestrate`  
→ Review: `artifacts/orchestration-results-*.json`  

### I want to see what agents produced
→ Check **[artifacts/README.md](artifacts/README.md)**  
→ Run: `jq '.' artifacts/orchestration-results-*.json`  

### I want to develop the application
→ Read **[DOMAIN_MODEL.md](DOMAIN_MODEL.md)** (entities)  
→ Check **artifacts/orchestration-results-*.json** (detailed specs)  
→ Develop in **src/** folder  

### I want to understand the domain
→ Read **[DOMAIN_MODEL.md](DOMAIN_MODEL.md)** (entities & relationships)  
→ Check **artifacts/phase-3-data-model/** (detailed model)  

### I want to understand the compliance rules
→ Check **artifacts/phase-1-discovery/rules-catalog.md** (discovered rules)  
→ Check **artifacts/phase-4-rules-engine/** (rule implementation)  

### I want to understand the UI/UX design
→ Check **artifacts/phase-5-ux-design/** (wireframes & flows)  
→ Check **artifacts/phase-6-frontend/** (component specs)  

### I want to run tests
→ Run: `npm test`  
→ Check **artifacts/phase-7-qa/** (test strategy)  

### I want to deploy
→ Check **artifacts/phase-9-deployment/** (deployment guide)  
→ Use **artifacts/phase-9-deployment/deployment-checklist.md** for the repeatable build/deploy verification steps  
→ Run: `npm run build:static`  
→ Run: `npm run deploy:static`  

### I want to understand the architecture
→ Check **artifacts/phase-2-architecture/** (architecture diagram)  

## Phase Progression

```
PHASE 1: Product & Domain Agent
↓ gathers requirements, rules, workflows
↓
PHASE 2: Solution Architect Agent (branches)
├─ designs architecture → PHASE 3: Data Model Agent
│                               ↓
│                           PHASE 4: Rules Engine Agent
│                               ↓
│                           PHASE 7: QA & Testing Agent
│
└─ PHASE 9: Deployment & Ops Agent

PHASE 5: Scheduling UX Agent
↓
PHASE 6: Frontend Engineering Agent
↓
PHASE 7: QA & Testing Agent (again)

PHASE 8: Documentation Agent
↓
PHASE 9: Deployment & Ops Agent (again)
```

## Key Commands

```bash
# Setup
npm install

# Run full orchestration
npm run orchestrate

# View latest results
cat artifacts/orchestration-results-*.json | jq .

# Extract specific phase
jq '.dataModel' artifacts/orchestration-results-*.json

# Develop
npm run dev

# Test
npm test

# Build
npm run build

# Lint
npm run lint

# Type check
npm run type-check

# Build release bundle
npm run build:static

# Deploy release bundle
npm run deploy:static
```

## Decision Points

### Need to change project scope?
→ Edit **PROJECT.md** → Re-run `npm run orchestrate`

### Need to adjust agent specifications?
→ Edit **AGENTS.md** → Re-run `npm run orchestrate`

### Need to update user stories?
→ Edit **BACKLOG.md** → Reference in orchestration

### Need to modify domain model?
→ Edit **DOMAIN_MODEL.md** → Re-run orchestration

### Want to use different AI provider?
→ See **AGENT_GUIDE.md** "Customizing Agent Behavior"

### Want to enable/disable context compression?
→ See **AGENT_GUIDE.md** "Configure Context Compression"

## Artifact Workflow

1. **Generate**
   ```bash
   npm run orchestrate
   ```

2. **Extract** (optional - for human review)
   ```bash
   jq '.requirements' artifacts/orchestration-results-*.json > artifacts/phase-1-discovery/requirements.md
   ```

3. **Review**
   - Check outputs in `artifacts/orchestration-results-*.json`
   - Review phase-specific directories

4. **Approve**
   - Sign off on specifications
   - Note any required changes

5. **Develop**
   - Implement based on specifications
   - Reference phase outputs for guidance

6. **Iterate**
   - If specs change, re-run orchestration
   - Compare results with previous run
   - Update artifacts

## Project Status

| Phase | Status | Artifact |
|-------|--------|----------|
| 1. Product & Domain | Generated by Agent | orchestration-results-*.json |
| 2. Solution Architect | Generated by Agent | orchestration-results-*.json |
| 3. Data Model | Generated by Agent | orchestration-results-*.json |
| 4. Rules Engine | Generated by Agent | orchestration-results-*.json |
| 5. Scheduling UX | Generated by Agent | orchestration-results-*.json |
| 6. Frontend Engineering | Generated by Agent | orchestration-results-*.json |
| 7. QA & Testing | Generated by Agent | orchestration-results-*.json |
| 8. Documentation | Generated by Agent | orchestration-results-*.json |
| 9. Deployment & Ops | Generated by Agent | orchestration-results-*.json |

---

**Navigation**: [README](README.md) ← → [KICKOFF](KICKOFF.md) ← → [AGENT_GUIDE](AGENT_GUIDE.md)

Last Updated: February 4, 2026
