# Quick Reference Card

## Commands

```bash
# Setup
npm install                 # Install dependencies
npm run build              # Build TypeScript
npm run type-check         # Check types

# Development
npm run dev                # Run in dev mode
npm run api:dev            # Run API server
npm run api:openapi:client # Regenerate OpenAPI client
npm run orchestrate        # Run full agent orchestration
npm test                   # Run tests
npm run lint               # Lint code

# Utilities
npm run clean              # Remove build artifacts
npm run test:watch         # Test in watch mode
```

## Viewing Outputs

```bash
# Latest orchestration results
cat artifacts/orchestration-results-*.json | jq .

# Just requirements
jq '.requirements' artifacts/orchestration-results-*.json | head -50

# Just architecture
jq '.architecture' artifacts/orchestration-results-*.json | head -50

# Count lines
cat artifacts/orchestration-results-*.json | jq -r '.' | wc -l
```

## File Navigation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Start here |
| [STARTUP.md](STARTUP.md) | Setup checklist |
| [PROJECT.md](PROJECT.md) | Project charter |
| [AGENTS.md](AGENTS.md) | Agent specs |
| [BACKLOG.md](BACKLOG.md) | User stories |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md) | Data model |
| [AGENT_GUIDE.md](AGENT_GUIDE.md) | Agent system |
| [PROJECT_MAP.md](PROJECT_MAP.md) | Navigation |
| [KICKOFF.md](KICKOFF.md) | Kickoff guide |

## Project Structure

```
src/
├── domain/        # Domain entities (School, Staff, Schedule, etc.)
├── rules/         # Rules engine (compliance checks)
├── ui/            # React components (UI)
├── storage/       # Data persistence (IndexedDB)
└── index.ts       # Entry point

tests/             # Test suites

artifacts/         # Agent outputs
├── orchestration-results-*.json
├── phase-1-discovery/
├── phase-2-architecture/
├── phase-3-data-model/
├── phase-4-rules-engine/
├── phase-5-ux-design/
├── phase-6-frontend/
├── phase-7-qa/
├── phase-8-documentation/
└── phase-9-deployment/
```

## Key Concepts

### Domain Model
- **School** - Location with daycare
- **Staff** - Employee with certifications, availability, restrictions
- **Shift** - Time blocks assigned to staff
- **Schedule** - Weekly collection of shifts
- **Rule** - Compliance requirement
- **RuleViolation** - Detected rule breach

### Compliance Rules
- Staff-to-child ratios
- Required certifications
- Break requirements
- Shift length limits
- Coverage requirements

### Agents
1. **Product & Domain** - Requirements
2. **Solution Architect** - Architecture
3. **Data Model** - Entities
4. **Rules Engine** - Compliance
5. **Scheduling UX** - UI Design
6. **Frontend Engineering** - Implementation
7. **QA & Testing** - Tests
8. **Documentation** - Docs
9. **Deployment & Ops** - Release

## Success Metrics

✓ Schedule created in < 30 minutes  
✓ 80% of new users complete core tasks without training  
✓ 90%+ rule compliance detection  
✓ 85%+ test coverage  

## AI Providers

```typescript
// MockAIProvider (default, no API key needed)
import { MockAIProvider } from './.github/agents/spawnSubagent';

// OpenAI/Codex (requires API key)
import { OpenAIProvider } from './.github/agents/spawnSubagent';
new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4' })

// GitHub Copilot
import { CopilotProvider } from './.github/agents/spawnSubagent';
```

## Context Compression

```typescript
import { setCompressionConfig } from './.github/agents/spawnSubagent';

setCompressionConfig({
  maxContextSizeInMB: 10,
  compressionThresholdPercent: 70,
  enableAutoCompression: true,
});
```

## Getting Help

- **What do I build?** → PROJECT.md + BACKLOG.md
- **How do I build it?** → artifacts/orchestration-results-*.json
- **How do I run agents?** → AGENT_GUIDE.md
- **What files exist?** → PROJECT_MAP.md
- **Where do I start?** → STARTUP.md

## First Time Steps

```bash
# 1. Install
npm install

# 2. Review specs
cat PROJECT.md

# 3. Run orchestration
npm run orchestrate

# 4. View results
jq '.' artifacts/orchestration-results-*.json

# 5. Start coding
npm run dev
```

## Deployment Commands

```bash
npm run build:static
AWS_S3_BUCKET=<bucket> npm run deploy:static
```

After building, inspect `dist-static/build-metadata.json` and follow `artifacts/phase-9-deployment/deployment-guide.md` for cache-invalidation, metadata tracking, verification steps, the build/deploy env-variable matrix, and a CI checklist before notifying site directors.  
Run the step-by-step instructions in `artifacts/phase-9-deployment/deployment-checklist.md` whenever you stage a release so the same reproducible steps (build, metadata audit, cache invalidation, smoke tests, and rollback logging) are covered.

## Phase Outputs

| Phase | File | Contains |
|-------|------|----------|
| 1 | `.requirements` | Rules, workflows, requirements |
| 2 | `.architecture` | Architecture, tech stack |
| 3 | `.dataModel` | Entities, relationships |
| 4 | `.rulesEngine` | Rule definitions, tests |
| 5 | `.uiDesign` | Wireframes, component specs |
| 6 | `.frontend` | Implementation, state mgmt |
| 7 | `.testing` | Test strategy, test cases |
| 8 | `.documentation` | Technical & user docs |
| 9 | `.deployment` | Build, release, ops |

---

**Status**: Ready to go  
**Last Updated**: February 4, 2026  
**Next**: `npm run orchestrate`
