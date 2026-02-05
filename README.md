# Daycare Scheduler

A standalone scheduling application for managing school district daycare staff schedules with automatic compliance checking against state regulations and district policies.

## Features

- **Compliance Rules Engine** - Automatically validates schedules against configurable rules
- **Intuitive Scheduling UI** - Drag-and-drop interface for non-technical users
- **Workflow Templates** - Pre-built scheduling patterns and copy-forward capabilities
- **Offline-First** - Works completely standalone with local data persistence
- **Export & Reporting** - PDF, CSV exports and audit trails for compliance documentation
- **Multi-School Support** - Manage schedules across multiple school locations

## Project Status

🚀 **Under Active Development** (Agent-Driven Development Phase)

This project uses an agent orchestration system where specialized agents coordinate to build each phase:

1. **Product & Domain** (Requirements gathering)
2. **Solution Architect** (Architecture design)
3. **Data Model** (Domain entities)
4. **Rules Engine** (Compliance logic)
5. **Scheduling UX** (UI/UX design)
6. **Frontend** (Implementation)
7. **QA & Testing** (Test strategy)
8. **Documentation** (Technical & user guides)
9. **Deployment & Ops** (Release procedures)

## Quick Start

### 1. Run Agent Orchestration

```bash
# Install dependencies
npm install

# Run full orchestration (generates all phase outputs)
npm run orchestrate

# Outputs saved to: artifacts/orchestration-results-{timestamp}.json
```

### 2. Review Artifacts

```bash
# View requirements from Product & Domain agent
jq '.requirements' artifacts/orchestration-results-*.json

# View architecture from Solution Architect
jq '.architecture' artifacts/orchestration-results-*.json

# View all outputs
cat artifacts/orchestration-results-*.json | jq .
```

### 3. Develop Application

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Project Structure

```
scheduling/
├── src/
│   ├── domain/           # Domain model entities
│   │   ├── School.ts
│   │   ├── Staff.ts
│   │   ├── Schedule.ts
│   │   └── ...
│   ├── rules/            # Compliance rules engine
│   │   ├── RulesEngine.ts
│   │   ├── rules/
│   │   └── ...
│   ├── ui/               # React components (TBD)
│   │   ├── ScheduleGrid.tsx
│   │   ├── RuleViolations.tsx
│   │   └── ...
│   ├── storage/          # Data persistence (IndexedDB)
│   │   └── ...
│   └── index.ts
├── tests/                # Test suites
│   ├── domain.test.ts
│   ├── rules.test.ts
│   └── ...
├── artifacts/            # Agent outputs
│   ├── orchestration-results-*.json
│   ├── phase-1-discovery/
│   ├── phase-2-architecture/
│   ├── phase-3-data-model/
│   ├── phase-4-rules-engine/
│   ├── phase-5-ux-design/
│   ├── phase-6-frontend/
│   ├── phase-7-qa/
│   ├── phase-8-documentation/
│   ├── phase-9-deployment/
│   └── README.md
├── .github/
│   └── agents/           # Agent orchestration system
│       ├── spawnSubagent.ts
│       ├── spawnSubagent.integration.ts
│       └── ...
├── KICKOFF.md            # Project kickoff guide
├── PROJECT.md            # Project charter
├── AGENTS.md             # Agent specifications
├── BACKLOG.md            # User stories & tasks
├── DOMAIN_MODEL.md       # Domain entities
├── AGENT_GUIDE.md        # How to use agent system
├── orchestrate.ts        # Orchestration entry point
├── package.json
├── tsconfig.json
└── README.md (this file)
```

## Documentation

- **[KICKOFF.md](KICKOFF.md)** - Project overview and kickoff guide
- **[PROJECT.md](PROJECT.md)** - Detailed project charter
- **[AGENTS.md](AGENTS.md)** - Agent specifications and responsibilities
- **[BACKLOG.md](BACKLOG.md)** - User stories and tasks
- **[DOMAIN_MODEL.md](DOMAIN_MODEL.md)** - Domain entities and relationships
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** - How to run and customize the agent system
- **[artifacts/README.md](artifacts/README.md)** - How to work with agent outputs

## Core Concepts

### Domain Model

Key entities from the domain:
- **School** - A school daycare location
- **Staff** - Staff member with certifications, qualifications, availability
- **Shift** - Time block that a staff member is scheduled to work
- **Schedule** - Weekly schedule containing shifts
- **Rule** - Compliance rule that validates schedules
- **RuleViolation** - Detected violation of a compliance rule

### Rules Engine

The rules engine validates schedules against:
- Staff-to-child ratios for both at school and field trips
- Required staff certifications throughout the day
- Break time requirements
- Shift length and hours scheduled limits
- Coverage requirements
- Qualification constraints

### Agent Orchestration

Each phase is handled by a specialized agent:

1. **Product & Domain Agent** reads PROJECT.md and generates requirements
2. **Solution Architect Agent** designs the system architecture
3. **Data Model Agent** defines entities and relationships
4. **Rules Engine Agent** implements compliance rules
5. **Scheduling UX Agent** designs the user interface
6. **Frontend Engineering Agent** implements the UI
7. **QA & Testing Agent** creates test strategy
8. **Documentation Agent** writes documentation
9. **Deployment & Ops Agent** defines deployment process

Each agent loads the specification from AGENTS.md and can spawn downstream agents.

## Development Workflow

### Phase 1: Review & Approve Specifications

```bash
# Review the charter and agent specs
cat PROJECT.md AGENTS.md BACKLOG.md

# Edit if needed to align with your requirements
# (Agents will use these to generate outputs)
```

### Phase 2: Run Orchestration

```bash
# Generate all phase outputs using agents
npm run orchestrate

# Check the results
ls -lt artifacts/orchestration-results-*.json
```

### Phase 3: Review Agent Outputs

```bash
# View specific phase outputs
jq '.requirements' artifacts/orchestration-results-*.json
jq '.dataModel' artifacts/orchestration-results-*.json
jq '.rulesEngine' artifacts/orchestration-results-*.json
```

### Phase 4: Develop Implementation

```bash
# Extract phase outputs to phase-specific directories
jq '.requirements' artifacts/orchestration-results-*.json > artifacts/phase-1-discovery/requirements.md

# Develop based on specifications
npm run dev

# Run tests
npm test
```

### Phase 5: Build & Deploy

```bash
# Build the reproducible static bundle (runs lint, type check, tests, build)
npm run build:static

# Publish the bundle to your host (set env vars before running).
AWS_S3_BUCKET=<bucket> npm run deploy:static

# Deployment details live in artifacts/phase-9-deployment/deployment-guide.md
```

`npm run build:static` wraps `scripts/build-static.sh`, stages the compiled assets under `dist-static/`, writes `build-metadata.json` (commit, timestamp, Node/npm versions), and creates `dist-static-{timestamp}.tar.gz`. Use the ZIP or copy `dist-static/` to your static host, then follow the guide’s cache invalidation and metadata tracking steps before sharing the release with directors. See `artifacts/phase-9-deployment/build-scripts/README.md` for an itemized breakdown of the scripts, knobs such as `SKIP_TYPE_CHECK`, and the outputs they produce.

`npm run deploy:static` (`scripts/deploy-static.sh`) copies the staged `dist-static/` bundle to the destination you configure via environment variables (`AWS_S3_BUCKET`/`AWS_S3_PREFIX`, `DEPLOY_HOST`/`DEPLOY_PATH`, or `DEPLOY_LOCAL_PATH`). See `artifacts/phase-9-deployment/deployment-guide.md` for configuration examples, cache-invalidation tips, and verification steps. The same folder also points to `artifacts/phase-9-deployment/build-scripts/README.md` if you need the automation-summary for each script invoked in the workflow.

## Configuration

### AI Provider

Configure which AI service to use:

```typescript
// In orchestrate.ts or your code:
import { setAIProvider, OpenAIProvider } from './.github/agents/spawnSubagent';

setAIProvider(new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
}));
```

Options:
- `OpenAIProvider` - Uses OpenAI API (requires API key)
- `CopilotProvider` - Uses GitHub Copilot API
- `MockAIProvider` - Simulates AI (for testing, no API needed)

### Context Compression

Large context is automatically compressed to prevent API limits:

```typescript
import { setCompressionConfig } from './.github/agents/spawnSubagent';

setCompressionConfig({
  maxContextSizeInMB: 10,
  compressionThresholdPercent: 70,
  enableAutoCompression: true,
});
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

Key test areas:
- Domain model validation
- Rules engine compliance checks
- UI component integration
- Workflow scenarios
- Edge cases

## Architecture Principles

- **Standalone** - Works completely offline
- **Domain-Driven** - Clear separation between domain logic and UI
- **Compliance-First** - Rules engine is core, not an afterthought
- **Testable** - All rules are independently testable
- **Extensible** - Easy to add new, remove and change rules, staff, etc.
- **Non-Technical UX** - Intuitive for school administrators

## Success Metrics

The project succeeds when:
- ✓ Scheduler creates compliant schedule in < 30 minutes
- ✓ 80% of new users complete core tasks without training  
- ✓ 90%+ rule compliance detection rate
- ✓ 85%+ test coverage for critical paths
- ✓ App deployable as standalone HTML5 files

## Contributing

1. Review specifications in PROJECT.md and AGENTS.md
2. Run: `npm run orchestrate`
3. Review outputs in artifacts/
4. Develop against the specifications
5. Test thoroughly
6. Update documentation

## Support

For questions about:
- **Project scope** - See PROJECT.md
- **Agent system** - See AGENT_GUIDE.md
- **Development** - See artifacts/orchestration-results-*.json
- **User stories** - See BACKLOG.md

## License

MIT

---

**Last Updated**: February 4, 2026  
**Agent System**: v0.1.0  
**Status**: Kickoff Complete - Ready for Orchestration
