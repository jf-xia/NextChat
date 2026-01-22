---
title: "System Architecture Overview"
doc_id: "ARCH-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@dev-lead"
tags: ["architecture", "backend", "frontend", "api", "core-document"]
audience: ["new-developer", "devops", "architect"]
purpose: "Provides comprehensive system architecture documentation for understanding codebase structure and data flow."
---

# System Architecture Overview

## High-Level Architecture

AIChat follows a **Next.js App Router** architecture with client-side state management and multi-provider API integrations.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PWA Web    │  │  Tauri App  │  │    iOS App          │  │
│  │  (Next.js)  │  │  (Desktop)  │  │    (Native)         │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  /app/api/[provider]/                 │  │
│  │  OpenAI | Anthropic | Google | Azure | DeepSeek | ... │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   /budget   │  │  /sessions  │  │      /config        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐ ┌────────┐  │
│  │ OpenAI │ │Anthropic│ │ Google │ │  Azure   │ │DeepSeek│  │
│  └────────┘ └─────────┘ └────────┘ └──────────┘ └────────┘  │
│  ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐ ┌────────┐  │
│  │ Baidu  │ │ Alibaba │ │ByteDance│ │ Moonshot │ │ 302.AI │  │
│  └────────┘ └─────────┘ └────────┘ └──────────┘ └────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (Optional)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     MySQL/MariaDB (via Prisma) - Session Storage      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      IndexedDB (Browser) - Local Storage Default      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Details

### Frontend Stack

| Layer      | Technology                                 | Version | Purpose                  |
| ---------- | ------------------------------------------ | ------- | ------------------------ |
| Framework  | `[framework: Next.js]`                     | 14.1.x  | React framework with SSR |
| UI Library | `[lib: React]`                             | 18.2.x  | Component library        |
| Language   | `[lang: TypeScript]`                       | 5.x     | Type safety              |
| Styling    | `[tool: SASS/SCSS]`                        | 1.59.x  | CSS preprocessor         |
| State      | `[lib: Zustand]`                           | 4.3.x   | State management         |
| Routing    | `[lib: react-router-dom]`                  | 6.x     | Client-side routing      |
| Markdown   | `[lib: react-markdown]`                    | 8.x     | Markdown rendering       |
| Math       | `[lib: rehype-katex]` `[lib: remark-math]` | -       | LaTeX equations          |
| Diagrams   | `[lib: mermaid]`                           | 10.6.x  | Diagram rendering        |
| DnD        | `[lib: @hello-pangea/dnd]`                 | 16.x    | Drag and drop            |
| Emoji      | `[lib: emoji-picker-react]`                | 4.x     | Emoji selection          |

### Backend Stack

| Layer      | Technology               | Purpose           |
| ---------- | ------------------------ | ----------------- |
| Runtime    | `[runtime: Node.js]` 20+ | Server runtime    |
| API Routes | Next.js App Router       | API endpoints     |
| ORM        | `[lib: Prisma]`          | Database access   |
| Auth       | `[lib: @azure/msal]`     | Azure AD auth     |
| HTTP       | `[lib: axios]`           | HTTP client       |
| Validation | `[lib: zod]`             | Schema validation |

### Desktop Stack (Tauri)

| Component | Technology               | Purpose            |
| --------- | ------------------------ | ------------------ |
| Core      | `[framework: Tauri]` 2.x | Desktop framework  |
| Backend   | `[lang: Rust]`           | Native performance |
| Config    | `tauri.conf.json`        | App configuration  |

### Infrastructure

| Component | Technology                     | Purpose                  |
| --------- | ------------------------------ | ------------------------ |
| Hosting   | `docker-compose` (self-hosted) | Primary deployment       |
| Container | `[tool: Docker]`               | Self-hosted deployment   |
| Proxy     | `[tool: nginx]`                | Reverse proxy            |
| Database  | `[db: MySQL]`                  | Optional session storage |
| CI/CD     | GitHub Actions                 | Automation               |

## Directory Structure Deep Dive

### `/app` - Application Core

```
app/
├── api/                      # Next.js API routes
│   ├── [provider]/           # Dynamic provider routes
│   │   └── route.ts          # Provider-specific handler
│   ├── 302ai.ts              # 302.AI provider
│   ├── alibaba.ts            # Alibaba/Qwen provider
│   ├── anthropic.ts          # Anthropic/Claude provider
│   ├── azure.ts              # Azure OpenAI provider
│   ├── baidu.ts              # Baidu/ERNIE provider
│   ├── bytedance.ts          # ByteDance provider
│   ├── deepseek.ts           # DeepSeek provider
│   ├── glm.ts                # ChatGLM provider
│   ├── google.ts             # Google/Gemini provider
│   ├── iflytek.ts            # iFlytek/Spark provider
│   ├── moonshot.ts           # Moonshot/Kimi provider
│   ├── openai.ts             # OpenAI provider
│   ├── siliconflow.ts        # SiliconFlow provider
│   ├── tencent/              # Tencent/Hunyuan provider
│   ├── xai.ts                # XAI/Grok provider
│   ├── auth.ts               # Authentication
│   ├── common.ts             # Shared utilities
│   ├── proxy.ts              # Proxy handling
│   ├── budget/               # Usage budget tracking
│   ├── config/               # Configuration endpoints
│   ├── sessions/             # Session management
│   └── webdav/               # WebDAV sync
│
├── client/                   # Client-side API layer
│   ├── api.ts                # API client
│   ├── controller.ts         # Request controller
│   └── platforms/            # Per-provider clients
│       ├── openai.ts
│       ├── anthropic.ts
│       ├── google.ts
│       └── ...
│
├── components/               # React components
│   ├── home.tsx              # Main app container
│   ├── chat.tsx              # Chat interface
│   ├── chat-list.tsx         # Chat session list
│   ├── sidebar.tsx           # Navigation sidebar
│   ├── settings.tsx          # Settings panel
│   ├── mask.tsx              # Prompt templates
│   ├── mcp-market.tsx        # MCP marketplace
│   ├── artifacts.tsx         # Artifacts viewer
│   ├── markdown.tsx          # Markdown renderer
│   ├── model-config.tsx      # Model configuration
│   └── *.module.scss         # Component styles
│
├── store/                    # Zustand state stores
│   ├── index.ts              # Store exports
│   ├── chat.ts               # Chat state
│   ├── config.ts             # App configuration
│   ├── access.ts             # Access control
│   ├── mask.ts               # Prompt templates
│   ├── plugin.ts             # Plugin state
│   ├── prompt.ts             # System prompts
│   ├── sync.ts               # Sync state
│   └── update.ts             # Update state
│
├── mcp/                      # Model Context Protocol
│   ├── actions.ts            # MCP actions
│   ├── client.ts             # MCP client
│   ├── types.ts              # Type definitions
│   └── mcp_config.json       # MCP configuration
│
├── locales/                  # i18n translations
├── masks/                    # Prompt template data
├── config/                   # Build configuration
├── icons/                    # SVG icons
├── lib/                      # Utility libraries
├── styles/                   # Global styles
└── utils/                    # Helper utilities
```

### `/prisma` - Database Schema

```
prisma/
└── schema.prisma    # MySQL schema for sessions
```

**Models:**
- `AiUser` - User records (email-based)
- `AiSession` - Chat session storage with messages, counts, timestamps

### `/src-tauri` - Desktop Application

```
src-tauri/
├── src/             # Rust source code
├── icons/           # App icons
├── tauri.conf.json  # Tauri configuration
└── Cargo.toml       # Rust dependencies
```

## Data Flow Patterns

### Chat Request Flow

```
1. User Input
   ↓
2. Chat Component (app/components/chat.tsx)
   ↓
3. Chat Store (app/store/chat.ts)
   ↓
4. API Client (app/client/api.ts)
   ↓
5. Platform Client (app/client/platforms/[provider].ts)
   ↓
6. API Route (app/api/[provider]/route.ts)
   ↓
7. External AI Provider
   ↓
8. Streaming Response
   ↓
9. UI Update
```

### State Management Pattern

Zustand stores follow this pattern:

```typescript
// Store structure
interface ChatStore {
  sessions: Session[]
  currentSession: Session
  
  // Actions
  newSession(): void
  deleteSession(id: string): void
  updateMessage(id: string, content: string): void
}

// Usage in components
const sessions = useChatStore((state) => state.sessions)
```

### Storage Layers

1. **Browser (Default)**: IndexedDB via `idb-keyval`
   - Chat history
   - Settings
   - Prompt templates

2. **MySQL (Optional)**: Via Prisma
   - Session sync
   - Multi-device support
   - Enterprise deployments

3. **WebDAV (Optional)**: Cloud sync
   - UpStash integration
   - Custom WebDAV endpoints

## API Provider Integration Pattern

Each provider follows this pattern:

```
/app/api/[provider].ts       - Server-side API handler
/app/client/platforms/[provider].ts - Client-side adapter

Common interface:
- chat(): Send chat messages
- models(): List available models  
- usage(): Check usage/limits
```

### Provider Authentication

| Provider  | Auth Method       | Config                       |
| --------- | ----------------- | ---------------------------- |
| OpenAI    | Bearer Token      | `OPENAI_API_KEY`             |
| Anthropic | x-api-key Header  | `ANTHROPIC_API_KEY`          |
| Azure     | Bearer + Endpoint | `AZURE_API_KEY`, `AZURE_URL` |
| Google    | Bearer Token      | `GOOGLE_API_KEY`             |

## MCP (Model Context Protocol) Integration

MCP enables extensible tool use:

```
app/mcp/
├── client.ts           # MCP client implementation
├── actions.ts          # Available MCP actions
├── types.ts            # Type definitions
└── mcp_config.json     # Server configurations
```

**Enable MCP**: Set `ENABLE_MCP=true` environment variable

## Build Modes

| Mode        | Command       | Output             | Use Case              |
| ----------- | ------------- | ------------------ | --------------------- |
| Development | `yarn dev`    | Hot reload         | Local development     |
| Standalone  | `yarn build`  | `.next/standalone` | Docker deployment     |
| Export      | `yarn export` | Static files       | Tauri, static hosting |

## Key Configuration Files

| File                   | Purpose                       |
| ---------------------- | ----------------------------- |
| `next.config.mjs`      | Next.js configuration         |
| `tsconfig.json`        | TypeScript configuration      |
| `package.json`         | Dependencies and scripts      |
| `.env.local`           | Environment variables (local) |
| `docker-compose.yml`   | Docker services               |
| `prisma/schema.prisma` | Database schema               |

## Performance Considerations

1. **Client Bundle**: ~5MB compressed, optimized chunks
2. **First Load**: ~100KB critical path
3. **Streaming**: SSE for AI responses
4. **Caching**: React.cache() for server components
5. **Code Splitting**: Dynamic imports for providers

## Security Architecture

1. **API Keys**: Server-side only, never exposed to client
2. **Access Code**: Optional password protection (`CODE` env)
3. **CORS**: Configurable in `next.config.mjs`
4. **Auth**: Azure AD integration for enterprise
5. **Data**: Local-first, optional cloud sync

## Monitoring Points

| What         | Where                                           |
| ------------ | ----------------------------------------------- |
| API Errors   | Browser console, container logs (`docker logs`) |
| Build Status | GitHub Actions                                  |
| Dependencies | Dependabot alerts                               |
| Performance  | Application metrics (Prometheus/Grafana)        |
