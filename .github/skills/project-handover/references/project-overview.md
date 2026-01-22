---
title: "AIChat Project Overview"
doc_id: "PROJ-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@project-lead"
tags: ["overview", "project", "aichat", "introduction", "core-document"]
audience: ["new-developer", "project-manager", "operations"]
purpose: "Provides comprehensive project overview for new team members and stakeholders during project handover."
---

# AIChat Project Overview

## Executive Summary

AIChat is a lightweight, high-performance AI assistant web application that supports multiple AI providers including Claude, DeepSeek, GPT-4, and Gemini Pro. The project targets self-hosted deployment via `docker-compose` and provides both web and desktop (via Tauri) experiences.

**Key Value Propositions:**
- Privacy-first: All data stored locally in browser
- Self-hosted deployment: `docker-compose` for predictable, private deployments
- Multi-platform: Web PWA + Desktop apps (Windows/Mac/Linux)
- Multi-provider: Supports 15+ AI providers
- MCP Support: Model Context Protocol integration for extensibility

## Project Status

| Metric            | Status                                    |
| ----------------- | ----------------------------------------- |
| Current Stage     | `[status: Active Development]`            |
| Version           | `[version: 2.15.x]`                       |
| License           | `[license: MIT]`                          |
| Primary Languages | `[lang: TypeScript]` `[lang: JavaScript]` |
| Framework         | `[framework: Next.js 14]`                 |

## Key Features

### Core Functionality
1. **Multi-Provider AI Chat** - Unified interface for multiple AI providers
2. **Prompt Templates (Masks)** - Create, share, and reuse prompt templates
3. **Artifacts** - Preview and share generated content in separate window
4. **Plugins** - Network search, calculator, and extensible API plugins
5. **Realtime Chat** - Voice-based realtime chat support
6. **MCP Integration** - Model Context Protocol for advanced tool use

### Platform Support
- **Web**: Progressive Web App (PWA) with offline support
- **Desktop**: Tauri-based apps for Windows, macOS, Linux
- **iOS**: Native iOS app available

## Technology Stack Summary

| Component        | Technology                                              | Notes                     |
| ---------------- | ------------------------------------------------------- | ------------------------- |
| Frontend         | `[framework: Next.js 14]` `[lang: TypeScript]`          | React 18 based            |
| Styling          | `[tool: SASS]` `[tool: CSS Modules]`                    | Scoped styling            |
| State Management | `[lib: Zustand]`                                        | Lightweight state         |
| Markdown         | `[lib: react-markdown]` `[lib: rehype]` `[lib: remark]` | Full MD support           |
| Desktop          | `[tool: Tauri]`                                         | Cross-platform            |
| Database         | `[db: MySQL via Prisma]`                                | Optional sessions storage |
| Deployment       | `docker-compose` (self-hosted)                          | docker-compose only       |

## Supported AI Providers

The project supports these AI service providers:

| Provider       | Primary Use         | Auth Type        |
| -------------- | ------------------- | ---------------- |
| OpenAI         | GPT-4, GPT-3.5      | API Key          |
| Anthropic      | Claude 3.x          | API Key          |
| Google         | Gemini Pro          | API Key          |
| Azure OpenAI   | Enterprise GPT      | API Key + URL    |
| DeepSeek       | DeepSeek models     | API Key          |
| Alibaba (Qwen) | Qwen models         | API Key          |
| Baidu (ERNIE)  | ERNIE models        | API Key + Secret |
| ByteDance      | Doubao models       | API Key          |
| Moonshot       | Kimi models         | API Key          |
| iFlytek        | Spark models        | API Key + Secret |
| Tencent        | Hunyuan models      | API Key          |
| SiliconFlow    | Various models      | API Key          |
| 302.AI         | Multi-model gateway | API Key          |
| XAI            | Grok models         | API Key          |
| ChatGLM        | GLM models          | API Key          |

## Project Structure Overview

```
NextChat/
├── app/                    # Next.js App Router
│   ├── api/               # API routes for each provider
│   ├── client/            # Client-side API handlers
│   │   └── platforms/     # Per-provider implementations
│   ├── components/        # React components
│   ├── store/             # Zustand stores
│   ├── mcp/               # Model Context Protocol
│   ├── locales/           # i18n translations
│   └── styles/            # Global styles
├── prisma/                # Database schema
├── public/                # Static assets
├── scripts/               # Build/utility scripts
├── src-tauri/             # Tauri desktop app
├── docs/                  # Documentation
└── docker/                # Docker configuration
```

## Roadmap

### Completed Features
- [x] System/User prompts
- [x] Prompt templates (Masks)
- [x] Image sharing, ShareGPT integration
- [x] Desktop app via Tauri
- [x] Self-hosted model support (LocalAI, RWKV)
- [x] Artifacts support
- [x] Plugin system
- [x] Realtime chat
- [x] MCP Integration

### Planned Features
- [ ] Local knowledge base integration
- [ ] Enhanced plugin ecosystem
- [ ] Improved multi-modal support

## Key Contacts and Resources

### Official Links
- **SaaS**: https://AIChat.club
- **Demo**: https://app.AIChat.club
- **GitHub**: https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web
- **Discord**: https://discord.gg/zrhvHCr79N

### Documentation
- Main README: `/README.md`
- Chinese docs: `/README_CN.md`
- Japanese docs: `/README_JA.md`
- Korean docs: `/README_KO.md`

## Enterprise Edition

For enterprise requirements:
- Brand customization
- Resource integration and management
- Permission control via Admin Panel
- Knowledge base integration
- Security auditing
- Private deployment

Contact: `business@AIChat.dev`

## Health Indicators

Monitor these for project health:

| Indicator    | Where to Check                    |
| ------------ | --------------------------------- |
| CI/CD Status | GitHub Actions tab                |
| Dependencies | `package.json`, Dependabot alerts |
| Issues/PRs   | GitHub Issues/Pull Requests       |
| Build Status | GitHub Actions                    |
| Error Logs   | `docker logs` / container logs    |

## Quick Links for New Team Members

1. **Start here**: Read this document
2. **Architecture deep-dive**: `references/architecture-overview.md`
3. **Set up environment**: `references/local-development-setup.md`
4. **Contribute code**: `references/contribution-guide.md`
5. **Deploy changes**: `references/deployment-guide.md`
