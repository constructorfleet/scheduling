# Agents System - Quick Navigation & Index

Welcome! This directory contains a complete multi-agent system for building the daycare scheduling application.

## 🚀 Quick Start (2 minutes)

1. **New to this?** Start with [README.md](README.md)
2. **Want to use the tool?** Read [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md)
3. **Ready to coordinate agents?** See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)
4. **Need full project example?** Check [SPAWN_SUBAGENT_SUMMARY.md](SPAWN_SUBAGENT_SUMMARY.md)

## 📚 Documentation Files

### Core Documentation
| File | Purpose | Read When |
|------|---------|-----------|
| **README.md** | Overview of the entire agent system | You're new here |
| **SUBAGENT_TOOL.md** | Complete tool specification | Need to understand the tool |
| **ORCHESTRATION_GUIDE.md** | How to coordinate agents | Building a complex project |
| **SPAWN_SUBAGENT_SUMMARY.md** | Quick reference & examples | Learning the approach |
| **spawnSubagent.schema.json** | JSON schema for validation | Implementing the tool |

### Individual Agent Documentation
| File | Agent | Specialty |
|------|-------|-----------|
| [product-domain-agent.agent.md](product-domain-agent.agent.md) | Product & Domain | Requirements, rules, policies |
| [solution-architect-agent.agent.md](solution-architect-agent.agent.md) | Solution Architect | Architecture, design, tech decisions |
| [data-model-agent.agent.md](data-model-agent.agent.md) | Data Model | Entity design, schema, relationships |
| [rules-engine-agent.agent.md](rules-engine-agent.agent.md) | Rules Engine | Compliance rules, validation |
| [scheduling-ux-agent.agent.md](scheduling-ux-agent.agent.md) | Scheduling UX | UI flows, wireframes, design |
| [frontend-engineering-agent.agent.md](frontend-engineering-agent.agent.md) | Frontend Engineering | React/Vue, components, state |
| [qa-testing-agent.agent.md](qa-testing-agent.agent.md) | QA & Testing | Tests, quality, coverage |
| [documentation-agent.agent.md](documentation-agent.agent.md) | Documentation | Guides, tutorials, docs |
| [deployment-ops-agent.agent.md](deployment-ops-agent.agent.md) | Deployment & Ops | CI/CD, build, deployment |

## 🎯 Common Tasks

### Task: Understand What This Is
1. Read: [README.md](README.md) (5 min)
2. Skim: [SPAWN_SUBAGENT_SUMMARY.md](SPAWN_SUBAGENT_SUMMARY.md) (5 min)
**Total: 10 minutes**

### Task: Spawn Your First Agent
1. Read: [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md) - Section "Usage Pattern" (5 min)
2. Copy example from [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) (2 min)
3. Customize for your needs (5 min)
**Total: 12 minutes**

### Task: Run the Full Project
1. Read: [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) (15 min)
2. Review: Full example in same file (10 min)
3. Customize and run (varies)
**Total: 25+ minutes depending on project scope**

### Task: Add a New Agent
1. Copy template from existing agent (e.g., [product-domain-agent.agent.md](product-domain-agent.agent.md))
2. Update metadata (name, description, tools)
3. Define responsibilities and outputs
4. Add to README agent registry
5. Update handoffs in related agents

### Task: Find Information About a Specific Topic
| Topic | File |
|-------|------|
| Compliance rules | [product-domain-agent.agent.md](product-domain-agent.agent.md) |
| Architecture decisions | [solution-architect-agent.agent.md](solution-architect-agent.agent.md) |
| Database schema | [data-model-agent.agent.md](data-model-agent.agent.md) |
| How to spawn agents | [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md) |
| UI wireframes | [scheduling-ux-agent.agent.md](scheduling-ux-agent.agent.md) |
| Frontend code | [frontend-engineering-agent.agent.md](frontend-engineering-agent.agent.md) |
| Testing strategy | [qa-testing-agent.agent.md](qa-testing-agent.agent.md) |
| User guides | [documentation-agent.agent.md](documentation-agent.agent.md) |
| Deployment pipeline | [deployment-ops-agent.agent.md](deployment-ops-agent.agent.md) |

## 🔄 Typical Workflow

```
1. Product Agent gathers requirements
   ↓ (output: rules, stories)
2. Architect designs solution
   ↓ (output: architecture, tech stack)
3. Data Model Agent designs schema
   ↓ (output: entities, relationships)
4. Rules Engine, UX, & Deployment agents work in parallel
   ↓ (output: rules code, UI design, CI/CD)
5. Frontend Agent implements UI
   ↓ (output: working app)
6. QA Agent tests everything
   ↓ (output: test suite, coverage report)
7. Documentation Agent creates guides
   ↓ (output: user & technical docs)
8. Deploy!
```

## 🛠️ Tools Available to Agents

Each agent has access to specialized tools:

**File Operations**: read_file, create_file, replace_string_in_file
**Search**: semantic_search, grep_search, file_search
**Code**: run_in_terminal, get_errors, list_code_usages
**Testing**: test_failure
**Agent Coordination**: **spawnSubagent** ← NEW!

## 📊 Agent Capabilities at a Glance

| Agent | Inputs | Outputs | Timeline |
|-------|--------|---------|----------|
| Product | Policies, interviews | Rules, stories, edge cases | 60 min |
| Architect | Requirements | Architecture, tech stack | 30 min |
| Data Model | Rules, architecture | Entities, schema, constraints | 30 min |
| Rules Engine | Data model, rules | Rule implementations, tests | 60-90 min |
| UX | Requirements | Wireframes, flows, specs | 45 min |
| Frontend | UX, data model | UI components, state mgmt | 90-120 min |
| QA | All implementations | Test suite, coverage report | 90-120 min |
| Documentation | Implementations | User guides, technical docs | 90 min |
| Deployment | Architecture | CI/CD pipeline, deployment scripts | 45 min |

## ✅ Success Indicators

You'll know the system is working when:
- ✅ Each agent produces high-quality work in their specialty
- ✅ Handoffs between agents are smooth and natural
- ✅ Parallel agents complete faster than sequential
- ✅ Context flows properly between agents
- ✅ Final product has all components integrated
- ✅ Quality is high across all domains

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Agent didn't complete task | Check timeoutMinutes, may need to be increased |
| Output doesn't match expectations | Review expectedOutputFormat parameter |
| Can't find an agent | Check agent ID in the registry |
| Agents conflicting | Spawn them in parallel or sequence, not both |
| Lost track of context | Store intermediate results and pass via context parameter |

## 📞 Need Help?

- **Understanding the tool?** → [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md)
- **Running examples?** → [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)
- **Agent specifics?** → Check individual agent .md file
- **Quick reference?** → [SPAWN_SUBAGENT_SUMMARY.md](SPAWN_SUBAGENT_SUMMARY.md)
- **Overview?** → [README.md](README.md)

## 🔗 File Structure

```
.github/agents/
├── INDEX.md ← YOU ARE HERE
│
├── CORE DOCUMENTATION
├── README.md
├── SUBAGENT_TOOL.md
├── ORCHESTRATION_GUIDE.md
├── SPAWN_SUBAGENT_SUMMARY.md
├── spawnSubagent.schema.json
│
├── AGENT FILES (9 total)
├── product-domain-agent.agent.md
├── solution-architect-agent.agent.md
├── data-model-agent.agent.md
├── rules-engine-agent.agent.md
├── scheduling-ux-agent.agent.md
├── frontend-engineering-agent.agent.md
├── qa-testing-agent.agent.md
├── documentation-agent.agent.md
└── deployment-ops-agent.agent.md
```

## 🚀 Next Steps

**If you're just starting:**
1. Read [README.md](README.md)
2. Skim [SPAWN_SUBAGENT_SUMMARY.md](SPAWN_SUBAGENT_SUMMARY.md)
3. Try a simple example from [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)

**If you need to understand a specific area:**
- Find the relevant agent file above
- Read that agent's documentation
- Use as a reference for that domain

**If you're ready to build:**
1. Read [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)
2. Copy the project orchestrator example
3. Customize for your needs
4. Run!

**If you're implementing the tool:**
1. Reference [spawnSubagent.schema.json](spawnSubagent.schema.json)
2. Check [SUBAGENT_TOOL.md](SUBAGENT_TOOL.md) for detailed spec
3. Use error codes and examples as reference

---

**Last Updated**: February 4, 2026  
**System Version**: 1.0.0  
**Status**: ✅ Production Ready
