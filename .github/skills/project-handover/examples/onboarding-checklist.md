# New Developer Onboarding Checklist

Use this checklist to track your onboarding progress. Complete each section in order.

## Day 1: Environment Setup

### Access & Accounts
- [ ] GitHub repository access granted
- [ ] Added to team Discord/Slack channel
- [ ] Received 1Password vault access (or equivalent secrets manager)
- [ ] Added to project management tool (Jira/Linear/GitHub Projects)

### Development Environment
- [ ] Clone repository: `git clone https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web.git`
- [ ] Install Node.js 18+ (use nvm recommended)
- [ ] Install Yarn: `npm install -g yarn`
- [ ] Install dependencies: `yarn install`
- [ ] Run dependency check: `.github/skills/project-handover/scripts/check-dependencies.sh`

### Configuration
- [ ] Copy environment file: `cp .env.example .env.local`
- [ ] Get API keys from password manager
- [ ] Configure `.env.local` with at least one AI provider key
- [ ] Validate configuration: `.github/skills/project-handover/scripts/validate-env.sh`

### First Run
- [ ] Start development server: `yarn dev`
- [ ] Access http://localhost:3000
- [ ] Test login with CODE (if configured)
- [ ] Send a test message to verify AI connection
- [ ] Build successfully: `yarn build`

## Day 2-3: Codebase Understanding

### Documentation
- [ ] Read project README.md
- [ ] Review architecture overview (`.github/skills/project-handover/references/architecture-overview.md`)
- [ ] Understand project structure
- [ ] Review contribution guidelines

### Code Exploration
- [ ] Explore `app/components/chat.tsx` - main chat interface
- [ ] Review `app/store/chat.ts` - state management
- [ ] Examine `app/api/openai.ts` - API integration pattern
- [ ] Understand `app/client/platforms/` - provider adapters

### Key Concepts
- [ ] Understand Zustand state management pattern
- [ ] Learn the API route → Client platform pattern
- [ ] Review streaming response handling
- [ ] Understand mask (prompt template) system

## Day 4-5: First Contribution

### Find a Task
- [ ] Browse GitHub Issues for `good-first-issue` label
- [ ] Read issue description and comments
- [ ] Ask questions if unclear
- [ ] Claim the issue

### Development Workflow
- [ ] Create feature branch: `git checkout -b feature/your-feature`
- [ ] Make code changes
- [ ] Run linter: `yarn lint`
- [ ] Test changes locally
- [ ] Commit with conventional format: `feat: add feature description`

### Submit PR
- [ ] Push branch: `git push origin feature/your-feature`
- [ ] Create Pull Request on GitHub
- [ ] Fill out PR template completely
- [ ] Request review from team
- [ ] Address review feedback
- [ ] Merge after approval

## Week 2: Deepen Understanding

### Advanced Topics
- [ ] Understand MCP (Model Context Protocol) integration
- [ ] Review Tauri desktop app structure
- [ ] Explore i18n/localization system
- [ ] Learn plugin architecture

### Team Integration
- [ ] Attend sprint planning/standup
- [ ] Shadow a senior developer on a feature
- [ ] Review a teammate's PR
- [ ] Present your first feature to team

## Ongoing

### Resources to Bookmark
- [ ] GitHub repository
- [ ] Project documentation
- [ ] Team Discord/Slack
- [ ] API provider documentation
- [ ] Docker host / docker-compose monitoring

### Knowledge Building
- [ ] Subscribe to repository notifications
- [ ] Follow project roadmap
- [ ] Participate in discussions
- [ ] Document learnings

## Completion Sign-off

| Milestone              | Completed | Date | Verified By |
| ---------------------- | --------- | ---- | ----------- |
| Environment Setup      | [ ]       |      |             |
| First Successful Build | [ ]       |      |             |
| Codebase Walkthrough   | [ ]       |      |             |
| First PR Merged        | [ ]       |      |             |
| Onboarding Complete    | [ ]       |      |             |

---

**Questions?** Contact your onboarding buddy or @dev-lead

**Feedback?** Help us improve this checklist by submitting suggestions!
