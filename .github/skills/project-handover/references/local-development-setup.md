---
title: "Local Development Setup Guide"
doc_id: "DEV-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@dev-lead"
tags: ["setup", "development", "environment", "installation", "onboarding"]
audience: ["new-developer"]
purpose: "Step-by-step guide for setting up local development environment for new team members."
---

# Local Development Setup Guide

## Prerequisites

Before starting, ensure your system has these tools installed:

| Tool    | Minimum Version  | Check Command      | Install Guide         |
| ------- | ---------------- | ------------------ | --------------------- |
| Node.js | 18.0+            | `node --version`   | https://nodejs.org/   |
| Yarn    | 1.22+            | `yarn --version`   | `npm install -g yarn` |
| Git     | 2.30+            | `git --version`    | https://git-scm.com/  |
| Docker  | 20.0+ (optional) | `docker --version` | https://docker.com/   |

### Optional Tools

| Tool      | Purpose                  | When Needed              |
| --------- | ------------------------ | ------------------------ |
| Docker    | Containerized deployment | Full stack testing       |
| MySQL     | Session storage          | Multi-device sync        |
| Tauri CLI | Desktop app development  | Building desktop version |

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web.git
cd ChatGPT-Next-Web
```

### Step 2: Install Dependencies

```bash
yarn install
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.local

# Edit with your API keys
# IMPORTANT: Get keys from team password manager
```

### Step 4: Start Development Server

```bash
yarn dev
```

Access the application at `http://localhost:3000`

## Environment Configuration

### Required Environment Variables

| Variable         | Required | Description                         | Source                        |
| ---------------- | -------- | ----------------------------------- | ----------------------------- |
| `OPENAI_API_KEY` | Yes*     | OpenAI API key                      | 1Password: `AIChat-Dev` vault |
| `CODE`           | No       | Access password(s), comma-separated | Set any value                 |

*At least one AI provider API key is required.

### AI Provider Keys (Choose at least one)

```bash
# OpenAI (most common)
OPENAI_API_KEY=sk-...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_API_KEY=AI...

# Azure OpenAI
AZURE_API_KEY=...
AZURE_URL=https://your-resource.openai.azure.com

# DeepSeek
DEEPSEEK_API_KEY=sk-...

# 302.AI (multi-model gateway)
AI302_API_KEY=...
```

### Optional Configuration

```bash
# Custom API endpoints
BASE_URL=https://api.openai.com  # Override OpenAI endpoint

# Organization
OPENAI_ORG_ID=org-...            # OpenAI organization

# Feature flags
ENABLE_MCP=true                   # Enable Model Context Protocol
DISABLE_GPT4=1                    # Disable GPT-4 access
HIDE_USER_API_KEY=1               # Hide user API key input

# Database (optional, for session sync)
AI_MYSQL_URL=mysql://user:pass@host:3306/db
```

### Complete .env.local Example

```bash
# ==== REQUIRED ====
OPENAI_API_KEY=your-openai-key-here

# ==== SECURITY ====
CODE=your-access-password

# ==== OPTIONAL PROVIDERS ====
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=
# AZURE_API_KEY=
# AZURE_URL=

# ==== FEATURES ====
ENABLE_MCP=true

# ==== DEVELOPMENT ====
# BASE_URL=http://localhost:4000  # Local proxy
```

## Available Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `yarn dev`             | Start development server with hot reload |
| `yarn build`           | Build production bundle                  |
| `yarn start`           | Start production server                  |
| `yarn lint`            | Run ESLint checks                        |
| `yarn test`            | Run test suite                           |
| `yarn mask`            | Build prompt mask templates              |
| `yarn prisma:generate` | Generate Prisma client                   |
| `yarn prisma:studio`   | Open Prisma database UI                  |

### Development Mode Options

```bash
# Standard development
yarn dev

# Development with HTTPS (for some API integrations)
yarn dev:https

# Development with proxy (if behind firewall)
yarn proxy-dev

# Export mode (for static/Tauri builds)
yarn export:dev
```

### Desktop App Development

```bash
# Prerequisites: Install Tauri CLI
cargo install tauri-cli

# Development
yarn app:dev

# Build desktop app
yarn app:build
```

## Project Structure Overview

```
.
├── app/                 # Next.js application
│   ├── api/            # API routes
│   ├── components/     # React components
│   ├── store/          # Zustand stores
│   └── mcp/            # MCP integration
├── prisma/             # Database schema
├── public/             # Static assets
├── scripts/            # Build scripts
├── src-tauri/          # Desktop app (Tauri)
└── docs/               # Documentation
```

## Common Development Tasks

### Adding a New AI Provider

1. Create API handler: `app/api/[provider].ts`
2. Create client adapter: `app/client/platforms/[provider].ts`
3. Add configuration: `app/constant.ts`
4. Update types: `app/typing.ts`

### Modifying UI Components

1. Components location: `app/components/`
2. Styles: Adjacent `*.module.scss` files
3. State: `app/store/` Zustand stores

### Working with Prompt Masks

1. Edit masks: `app/masks/`
2. Rebuild: `yarn mask`
3. Watch mode: `yarn mask:watch`

## Troubleshooting

### Common Issues

| Problem                    | Solution                                 |
| -------------------------- | ---------------------------------------- |
| `node: command not found`  | Install Node.js 18+                      |
| `EACCES permission denied` | Fix npm permissions or use nvm           |
| `API key invalid`          | Check .env.local formatting              |
| `Port 3000 in use`         | Kill process or use `PORT=3001 yarn dev` |
| `Module not found`         | Run `yarn install`                       |

### API Connection Issues

```bash
# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Use proxy if blocked
yarn proxy-dev
```

### Build Failures

```bash
# Clear cache and rebuild
rm -rf .next node_modules
yarn install
yarn build
```

### Database Issues (Prisma)

```bash
# Regenerate Prisma client
yarn prisma:generate

# Reset database
npx prisma db push --force-reset

# View database
yarn prisma:studio
```

## Docker Development

### Full Stack with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f chatweb

# Stop services
docker-compose down
```

### Build Docker Image

```bash
docker build -t aichat:dev .
docker run -p 3000:3000 --env-file .env.local aichat:dev
```

## IDE Setup Recommendations

### VS Code Extensions

- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense
- GitLens
- Prisma

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Security Reminders

> ⚠️ **IMPORTANT SECURITY PRACTICES**

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Get API keys from password manager** - Do not share via chat/email
3. **Use `CODE` in development** - Protect your local instance
4. **Rotate keys if exposed** - Immediately regenerate compromised keys

## Verification Checklist

After setup, verify these work:

- [ ] `yarn dev` starts without errors
- [ ] http://localhost:3000 loads
- [ ] Can log in with CODE (if set)
- [ ] Can send a test message
- [ ] AI responds correctly
- [ ] `yarn build` completes successfully
- [ ] `yarn lint` passes

## Getting Help

If stuck during setup:

1. Check [FAQ documentation](../../docs/faq-en.md)
2. Search [GitHub Issues](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/issues)
3. Ask in team Discord/Slack channel
4. Contact: @dev-lead

## Next Steps

After successful setup:

1. Read [Architecture Overview](./architecture-overview.md)
2. Review [Contribution Guide](./contribution-guide.md)
3. Explore codebase starting with `app/components/chat.tsx`
4. Pick a `good-first-issue` from GitHub Issues
