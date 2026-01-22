---
title: "Environment Variables Reference"
doc_id: "ENV-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@dev-lead"
tags: ["environment", "configuration", "api-keys", "settings"]
audience: ["developer", "devops"]
purpose: "Complete reference for all environment variables used in the project."
---

# Environment Variables Reference

## Core Configuration

### `CODE` (Optional but Recommended)

Access password for the application.

```bash
CODE=password1,password2,password3
```

- Multiple passwords can be comma-separated
- Users must enter one of these to access the app
- Redeploy required after changes

### `OPENAI_API_KEY` (Required*)

OpenAI API key for GPT models.

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

- Required if using OpenAI as provider
- Multiple keys can be comma-separated for load balancing
- Get from: https://platform.openai.com/account/api-keys

### `BASE_URL` (Optional)

Override OpenAI API endpoint.

```bash
BASE_URL=https://api.openai.com
```

- Default: `https://api.openai.com`
- Use for proxies or compatible endpoints
- Set to `http://` prefix if SSL issues occur

### `OPENAI_ORG_ID` (Optional)

OpenAI organization ID.

```bash
OPENAI_ORG_ID=org-xxxxxxxxxxxxxxxx
```

## AI Provider Configuration

### Azure OpenAI

```bash
AZURE_URL=https://your-resource.openai.azure.com
AZURE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
AZURE_API_VERSION=2024-02-15-preview
```

### Google Gemini

```bash
GOOGLE_API_KEY=AIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_URL=https://generativelanguage.googleapis.com
```

### Anthropic Claude

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_VERSION=2023-06-01
ANTHROPIC_URL=https://api.anthropic.com
```

### DeepSeek

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_URL=https://api.deepseek.com
```

### Baidu ERNIE

```bash
BAIDU_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
BAIDU_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
BAIDU_URL=https://aip.baidubce.com
```

### ByteDance Doubao

```bash
BYTEDANCE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
BYTEDANCE_URL=https://api.bytedance.com
```

### Alibaba Qwen

```bash
ALIBABA_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ALIBABA_URL=https://dashscope.aliyuncs.com
```

### iFlytek Spark

```bash
IFLYTEK_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
IFLYTEK_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
IFLYTEK_URL=https://spark-api.xf-yun.com
```

### ChatGLM

```bash
CHATGLM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
CHATGLM_URL=https://open.bigmodel.cn
```

### Moonshot (Kimi)

```bash
MOONSHOT_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
MOONSHOT_URL=https://api.moonshot.cn
```

### SiliconFlow

```bash
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
SILICONFLOW_URL=https://api.siliconflow.cn
```

### 302.AI

```bash
AI302_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
AI302_URL=https://api.302.ai
```

### XAI (Grok)

```bash
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxx
XAI_URL=https://api.x.ai
```

### Tencent Hunyuan

```bash
TENCENT_SECRET_ID=xxxxxxxxxxxxxxxxxxxxxxxx
TENCENT_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
TENCENT_URL=https://hunyuan.tencentcloudapi.com
```

### Stability AI (Image Generation)

```bash
STABILITY_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
STABILITY_URL=https://api.stability.ai
```

## Feature Flags

### `ENABLE_MCP` (Optional)

Enable Model Context Protocol support.

```bash
ENABLE_MCP=true
```

### `HIDE_USER_API_KEY` (Optional)

Prevent users from entering their own API key.

```bash
HIDE_USER_API_KEY=1
```

### `DISABLE_GPT4` (Optional)

Disable GPT-4 model access.

```bash
DISABLE_GPT4=1
```

### `ENABLE_BALANCE_QUERY` (Optional)

Allow users to query API balance.

```bash
ENABLE_BALANCE_QUERY=1
```

### `DISABLE_FAST_LINK` (Optional)

Disable parsing settings from URL.

```bash
DISABLE_FAST_LINK=1
```

## Model Configuration

### `CUSTOM_MODELS` (Optional)

Define custom model list.

```bash
# Add models with + prefix, remove with - prefix
CUSTOM_MODELS=+gpt-4-32k,-gpt-3.5-turbo

# Format: +modelname@provider=displayname
CUSTOM_MODELS=+llama-2-70b@localai=LocalLLama
```

### `DEFAULT_MODEL` (Optional)

Set default model selection.

```bash
DEFAULT_MODEL=gpt-4-turbo-preview
```

### `VISION_MODELS` (Optional)

Specify models with vision capability.

```bash
VISION_MODELS=gpt-4-vision-preview,gemini-pro-vision
```

### `DEFAULT_INPUT_TEMPLATE` (Optional)

Customize user input preprocessing template.

```bash
DEFAULT_INPUT_TEMPLATE="{{input}}"
```

## Sync Configuration

### `WHITE_WEBDAV_ENDPOINTS` (Optional)

Whitelist WebDAV endpoints for sync.

```bash
WHITE_WEBDAV_ENDPOINTS=https://dav.example.com,https://sync.example.org
```

## Database Configuration

### `AI_MYSQL_URL` (Optional)

MySQL connection string for session storage.

```bash
AI_MYSQL_URL=mysql://user:password@host:3306/database
```

## Build Configuration

### `BUILD_MODE` (Internal)

Build mode selector.

```bash
BUILD_MODE=standalone  # For Docker
BUILD_MODE=export      # For static/Tauri
```

### `DISABLE_CHUNK` (Internal)

Disable code splitting.

```bash
DISABLE_CHUNK=1
```

## Analytics

> No platform-specific analytics variables are required. Use provider dashboards or self-hosted monitoring integrations.

## Environment Priority

Variables are loaded in this order (later overrides earlier):

1. System environment variables
2. `.env` file
3. `.env.local` file (not committed)
4. Platform environment variables (host environment)

## Security Best Practices

1. **Never commit API keys**
   - Use `.env.local` for local development
   - Add to `.gitignore`

2. **Use platform secrets**
   - Docker: Secrets or `.env` file
   - Host environment: Use secure secret stores (Vault, Secrets Manager)

3. **Rotate keys regularly**
   - Set calendar reminders
   - Immediately rotate if exposed

4. **Minimum permissions**
   - Use restricted API keys when possible
   - Separate keys for dev/prod

## Quick Reference Table

| Variable                             | Required     | Provider  |
| ------------------------------------ | ------------ | --------- |
| `OPENAI_API_KEY`                     | Yes*         | OpenAI    |
| `ANTHROPIC_API_KEY`                  | For Claude   | Anthropic |
| `GOOGLE_API_KEY`                     | For Gemini   | Google    |
| `AZURE_API_KEY` + `AZURE_URL`        | For Azure    | Azure     |
| `DEEPSEEK_API_KEY`                   | For DeepSeek | DeepSeek  |
| `BAIDU_API_KEY` + `BAIDU_SECRET_KEY` | For ERNIE    | Baidu     |
| `CODE`                               | Recommended  | -         |
| `ENABLE_MCP`                         | For MCP      | -         |

*At least one AI provider is required.
