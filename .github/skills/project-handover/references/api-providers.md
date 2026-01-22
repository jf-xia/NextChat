---
title: "API Providers Guide"
doc_id: "API-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@dev-lead"
tags: ["api", "providers", "integration", "llm"]
audience: ["developer"]
purpose: "Detailed documentation for all supported AI providers and their integration patterns."
---

# API Providers Guide

## Provider Overview

AIChat supports 15+ AI providers with a unified interface. Each provider follows a consistent integration pattern.

## Integration Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  useChatStore() → api.chat() → platform.chat()     │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│                    API Route Layer                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  /api/[provider]/route.ts → Provider Handler        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│                    External Providers                       │
│  OpenAI | Anthropic | Google | Azure | DeepSeek | ...     │
└────────────────────────────────────────────────────────────┘
```

## Provider Details

### OpenAI

**Status**: Primary Provider
**Models**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, o1, o1-mini

| Configuration | Value                         |
| ------------- | ----------------------------- |
| Base URL      | `https://api.openai.com/v1`   |
| Auth Header   | `Authorization: Bearer {key}` |
| Streaming     | ✅ Supported                   |
| Vision        | ✅ Supported (GPT-4V)          |

**Files**:
- API Handler: `app/api/openai.ts`
- Client: `app/client/platforms/openai.ts`

**Environment**:
```bash
OPENAI_API_KEY=sk-...
BASE_URL=https://api.openai.com  # Optional override
OPENAI_ORG_ID=org-...  # Optional
```

### Anthropic Claude

**Status**: Primary Provider
**Models**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku

| Configuration | Value                          |
| ------------- | ------------------------------ |
| Base URL      | `https://api.anthropic.com/v1` |
| Auth Header   | `x-api-key: {key}`             |
| Streaming     | ✅ Supported                    |
| Vision        | ✅ Supported                    |

**Files**:
- API Handler: `app/api/anthropic.ts`
- Client: `app/client/platforms/anthropic.ts`

**Environment**:
```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_URL=https://api.anthropic.com  # Optional
ANTHROPIC_API_VERSION=2023-06-01  # Optional
```

### Google Gemini

**Status**: Primary Provider
**Models**: Gemini Pro, Gemini Pro Vision

| Configuration | Value                                          |
| ------------- | ---------------------------------------------- |
| Base URL      | `https://generativelanguage.googleapis.com/v1` |
| Auth          | API Key in URL                                 |
| Streaming     | ✅ Supported                                    |
| Vision        | ✅ Supported                                    |

**Files**:
- API Handler: `app/api/google.ts`
- Client: `app/client/platforms/google.ts`

**Environment**:
```bash
GOOGLE_API_KEY=AI...
GOOGLE_URL=https://generativelanguage.googleapis.com  # Optional
```

### Azure OpenAI

**Status**: Enterprise Provider
**Models**: GPT-4, GPT-3.5 (Azure-deployed)

| Configuration | Value                                        |
| ------------- | -------------------------------------------- |
| Base URL      | `https://{resource}.openai.azure.com/openai` |
| Auth Header   | `api-key: {key}`                             |
| Streaming     | ✅ Supported                                  |
| Vision        | ✅ Supported                                  |

**Files**:
- API Handler: `app/api/azure.ts`
- Client: `app/client/platforms/openai.ts` (shared)

**Environment**:
```bash
AZURE_URL=https://your-resource.openai.azure.com
AZURE_API_KEY=...
AZURE_API_VERSION=2024-02-15-preview
```

### DeepSeek

**Status**: China-friendly Provider
**Models**: DeepSeek-V2, DeepSeek-Coder

| Configuration | Value                         |
| ------------- | ----------------------------- |
| Base URL      | `https://api.deepseek.com/v1` |
| Auth Header   | `Authorization: Bearer {key}` |
| Streaming     | ✅ Supported                   |

**Files**:
- API Handler: `app/api/deepseek.ts`
- Client: `app/client/platforms/deepseek.ts`

**Environment**:
```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_URL=https://api.deepseek.com  # Optional
```

### Baidu ERNIE

**Status**: China Provider
**Models**: ERNIE-Bot, ERNIE-Bot 4.0

| Configuration | Value                               |
| ------------- | ----------------------------------- |
| Base URL      | `https://aip.baidubce.com`          |
| Auth          | API Key + Secret Key → Access Token |
| Streaming     | ✅ Supported                         |

**Files**:
- API Handler: `app/api/baidu.ts`
- Client: `app/client/platforms/baidu.ts`

**Environment**:
```bash
BAIDU_API_KEY=...
BAIDU_SECRET_KEY=...
BAIDU_URL=https://aip.baidubce.com  # Optional
```

### Alibaba Qwen

**Status**: China Provider
**Models**: Qwen-Turbo, Qwen-Plus, Qwen-Max

| Configuration | Value                                   |
| ------------- | --------------------------------------- |
| Base URL      | `https://dashscope.aliyuncs.com/api/v1` |
| Auth Header   | `Authorization: Bearer {key}`           |
| Streaming     | ✅ Supported                             |

**Files**:
- API Handler: `app/api/alibaba.ts`
- Client: `app/client/platforms/alibaba.ts`

**Environment**:
```bash
ALIBABA_API_KEY=sk-...
ALIBABA_URL=https://dashscope.aliyuncs.com  # Optional
```

### ByteDance Doubao

**Status**: China Provider
**Models**: Doubao models

**Files**:
- API Handler: `app/api/bytedance.ts`
- Client: `app/client/platforms/bytedance.ts`

**Environment**:
```bash
BYTEDANCE_API_KEY=...
BYTEDANCE_URL=...
```

### Moonshot (Kimi)

**Status**: China Provider
**Models**: moonshot-v1

**Files**:
- API Handler: `app/api/moonshot.ts`
- Client: `app/client/platforms/moonshot.ts`

**Environment**:
```bash
MOONSHOT_API_KEY=sk-...
MOONSHOT_URL=https://api.moonshot.cn  # Optional
```

### 302.AI

**Status**: Multi-Model Gateway
**Models**: Various (gateway to multiple providers)

**Files**:
- API Handler: `app/api/302ai.ts`
- Client: `app/client/platforms/ai302.ts`

**Environment**:
```bash
AI302_API_KEY=...
AI302_URL=https://api.302.ai
```

## Adding a New Provider

### Step 1: Create API Handler

```typescript
// app/api/[provider].ts
import { NextRequest, NextResponse } from "next/server";
import { prettyObject } from "@/app/utils/format";
import { auth } from "@/app/api/auth";

export async function POST(req: NextRequest) {
  try {
    const authResult = auth(req);
    if (authResult.error) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const body = await req.json();
    
    // Transform request to provider format
    const providerRequest = transformRequest(body);
    
    // Call provider API
    const response = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PROVIDER_API_KEY}`,
      },
      body: JSON.stringify(providerRequest),
    });

    // Handle streaming or JSON response
    if (body.stream) {
      return new Response(response.body, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    return NextResponse.json(await response.json());
  } catch (e) {
    return NextResponse.json(prettyObject(e), { status: 500 });
  }
}
```

### Step 2: Create Client Adapter

```typescript
// app/client/platforms/[provider].ts
import { LLMApi, ChatOptions, LLMModel } from "../api";

export class ProviderApi implements LLMApi {
  async chat(options: ChatOptions): Promise<void> {
    // Implement chat method
  }

  async models(): Promise<LLMModel[]> {
    // Return available models
  }
}
```

### Step 3: Register Provider

```typescript
// app/client/api.ts
import { ProviderApi } from "./platforms/[provider]";

export function getClientApi(provider: string): LLMApi {
  switch (provider) {
    case "provider":
      return new ProviderApi();
    // ... other cases
  }
}
```

### Step 4: Add Configuration

```typescript
// app/constant.ts
export const PROVIDER_MODELS = {
  "model-name": {
    name: "model-name",
    available: true,
    provider: {
      id: "provider",
      providerName: "Provider Name",
    },
  },
};
```

## Common Integration Patterns

### Request Transformation

Most providers follow OpenAI's format with minor differences:

```typescript
// OpenAI format (standard)
{
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }],
  stream: true
}

// Anthropic format
{
  model: "claude-3-opus",
  messages: [{ role: "user", content: "Hello" }],
  max_tokens: 4096,
  stream: true
}

// Google format
{
  contents: [{ role: "user", parts: [{ text: "Hello" }] }],
  generationConfig: { ... }
}
```

### Streaming Response Handling

```typescript
// SSE Stream parsing
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split("\n");
  
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      // Process data chunk
    }
  }
}
```

## Troubleshooting

| Issue            | Possible Cause          | Solution                              |
| ---------------- | ----------------------- | ------------------------------------- |
| 401 Unauthorized | Invalid API key         | Check key format and validity         |
| 429 Rate Limited | Too many requests       | Implement backoff, check quotas       |
| 500 Server Error | Provider issue          | Check provider status page            |
| Empty response   | Streaming misconfigured | Check content-type headers            |
| CORS errors      | Missing proxy           | Ensure requests go through API routes |
