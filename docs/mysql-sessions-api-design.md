# Prisma + MariaDB：按 email 获取用户 Sessions 接口设计（草案）

> 目的：在现有 NextChat（Next.js App Router）项目中新增一个 API 接口，从 MariaDB/MySQL 的 `ai_users` / `ai_sessions` 表中按用户 email 读取最近的 sessions，返回结果与给定 SQL 的字段一致。
>
> 约束：必须使用 `prisma@^7.2.0` 与 `@prisma/client@^7.2.0`（项目已存在依赖）。

## 1. 现状评估（基于当前仓库）

- 路由形态：项目使用 Next.js App Router API Routes，路径位于 `app/api/**/route.ts`，并普遍导出 `export const runtime = "nodejs"`（例如 `app/api/budget/route.ts`）。
- 鉴权形态：项目已有 Azure AD/JWT 鉴权实现 `app/api/auth.ts`。
  - 多数接口会调用 `auth(req, ModelProvider.xxx)`，其副作用是会访问 LITELLM 并改写请求头 Authorization（用于 LLM 代理），这对“纯数据库读取接口”并非必需。
  - `app/api/auth.ts` 已导出 `getUsernameByToken(token)`，可用于仅解析 token 并得到 email/username（副作用更小）。
- 数据库现状：仓库内暂未发现 `prisma/schema.prisma`、`prisma/` 目录或 Prisma Client 单例封装。
- 部署/环境变量：仓库的 `docker-compose.yml` 存在 `DATABASE_URL=postgresql://...`（用于其他服务），因此建议为本接口单独使用新的环境变量，避免与现有 `DATABASE_URL` 冲突。

结论：需要新增 Prisma schema 与 Prisma Client 单例，并新增一个 nodejs runtime 的 route handler 来实现查询。

## 2. 需求回放（你提供的 SQL）

目标查询：

```sql
SELECT
    s.id,
    s.topic,
    s.memory_prompt AS memoryPrompt,
    s.messages,
    s.token_count AS tokenCount,
    s.word_count AS wordCount,
    s.char_count AS charCount,
    s.updated_at AS lastUpdate,
    s.last_summarize_index AS lastSummarizeIndex,
    s.clear_context_index AS clearContextIndex
FROM
    ai_sessions s
JOIN
    ai_users u ON s.user_id = u.id
WHERE u.email = ? AND s.deleted_at IS NULL
ORDER BY
    s.updated_at DESC
LIMIT 20;
```

接口输入：`email`

接口输出：上述 SELECT 的结果数组。

## 3. API 方案设计

### 3.1 路径与方法

建议新增：

- `POST /api/mysql/sessions/by-email`

原因：
- email 属于敏感输入，使用 POST body 更不容易在日志/监控/浏览器历史中泄露（仍需在服务端日志避免打印）。

可选（如你更偏向 REST query）：
- `GET /api/mysql/sessions?email=...&limit=20`

### 3.2 Request / Response Contract

**Request(JSON)**

```json
{
  "email": "jackxia@hsu.edu.hk",
  "limit": 20
}
```

- `email`: 必填，标准 email。
- `limit`: 可选，默认 20；建议上限 100。

**Response(JSON)**

```json
[
  {
    "id": 1,
    "topic": "...",
    "memoryPrompt": "0",
    "messages": "...",
    "tokenCount": 0,
    "wordCount": 0,
    "charCount": 0,
    "lastUpdate": "2026-01-02T00:00:00.000Z",
    "lastSummarizeIndex": 0,
    "clearContextIndex": 0
  }
]
```

### 3.3 鉴权与授权（必须明确的决策点）

由于接口输入是 email，如果不做授权检查，任意登录用户都可能查询其他人的 sessions（数据泄露风险）。建议二选一：

A) **自查询模式（推荐默认）**
- 仍然接收 `email` 作为输入，但要求：`email` 必须等于 token 解析出的用户名/邮箱。
- 解析方式：调用 `getUsernameByToken(token)`（见 `app/api/auth.ts`）。
- 不一致时返回 `403`。

B) **管理员模式（仅当你确实需要）**
- 允许查询任意 email，但需要额外的“管理员判定”，例如：
  - token claims 中包含特定 role/group；或
  - 配置 `ADMIN_EMAIL_ALLOWLIST` 白名单。

文档默认采用 A)。如果你确认这是纯内部接口且不会暴露给普通用户，再切换到 B)。

### 3.4 错误码约定

- `400`: 参数校验失败（email 非法、limit 超范围）。
- `401`: 缺少/无效 Authorization。
- `403`: email 与 token 用户不匹配（自查询模式）。
- `200`: 成功（即使没找到用户，也返回 `[]`，或按你的偏好返回 `404`）。
- `500`: 数据库连接/查询异常。

## 4. Prisma 数据层设计

### 4.1 Prisma datasource

建议使用独立 env var（避免与现有 `DATABASE_URL` 冲突）：

- `AI_MYSQL_URL="mysql://user:pass@host:3306/dbname"`

Prisma schema 中：

```prisma
// prisma/schema.prisma

datasource db {
  provider = "mysql"
  url      = env("AI_MYSQL_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

> MariaDB 兼容 Prisma 的 mysql provider（底层 driver 为 `mysql2`）。

### 4.2 Model 映射（snake_case -> camelCase）

根据表结构定义两个 model，并用 `@@map` / `@map` 精确映射字段名。

核心注意点：
- `messages longtext` -> `String @db.LongText`
- `bigint unsigned` -> `BigInt @db.UnsignedBigInt`
- `varchar` -> `String @db.VarChar(255)`（或按长度）
- `deleted_at` / `created_at` / `updated_at` 允许 NULL -> `DateTime?`

示例（草案，字段可按实际 DB 再对齐）：

```prisma
model AiUser {
  id        BigInt     @id @default(autoincrement()) @db.UnsignedBigInt
  email     String     @unique @db.VarChar(150)

  name      String     @db.VarChar(55)
  usercode  String     @db.VarChar(55)
  firstname String     @db.VarChar(55)
  lastname  String     @db.VarChar(55)
  programme String     @db.VarChar(55)
  category  String     @db.VarChar(55)
  teaching  String     @db.VarChar(55)
  local     String     @db.VarChar(55)
  password  String     @db.VarChar(250)

  emailVerifiedAt DateTime? @map("email_verified_at")
  rememberToken   String?   @map("remember_token") @db.VarChar(100)
  createdAt       DateTime? @map("created_at")
  updatedAt       DateTime? @map("updated_at")

  sessions AiSession[]

  @@map("ai_users")
}

model AiSession {
  id                 BigInt    @id @default(autoincrement()) @db.UnsignedBigInt
  topic              String    @db.VarChar(255)
  memoryPrompt       String    @map("memory_prompt") @db.VarChar(255)
  messages           String    @db.LongText
  wordCount          Int       @default(0) @map("word_count")
  charCount          Int       @default(0) @map("char_count")
  tokenCount         Int       @default(0) @map("token_count")
  lastSummarizeIndex Int       @default(0) @map("last_summarize_index")
  clearContextIndex  Int       @default(0) @map("clear_context_index")

  userId   BigInt    @map("user_id") @db.UnsignedBigInt
  user     AiUser    @relation(fields: [userId], references: [id])

  createdAt DateTime? @map("created_at")
  updatedAt DateTime? @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@index([userId])
  @@index([updatedAt])
  @@map("ai_sessions")
}
```

> 备注：`memory_prompt` 在 SQL 中是 `varchar(255) default '0' not null`，所以在 Prisma 中直接用 `String` 并在写入时兜底；如果你需要在 ORM 层也体现默认值，可以用 `@default("0")`。

### 4.3 Prisma Client 单例

Next.js（尤其 dev/HMR）建议使用全局单例避免连接过多。

建议新增：
- `src/lib/prisma.ts` 或 `app/lib/prisma.ts`（按你项目现有目录习惯选一个）

伪代码：

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ["error"], // 可选
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## 5. Route Handler 实现要点（与现有项目风格对齐）

### 5.1 目录建议

新增 route：
- `app/api/mysql/sessions/by-email/route.ts`

并确保：
- `export const runtime = "nodejs";`（Prisma 不支持 Edge Runtime）

### 5.2 参数校验

使用项目已依赖的 `zod`：
- 校验 email 格式
- limit 默认 20，max 100

### 5.3 查询实现（Prisma 版）

对应 SQL 的 Prisma 查询形态：

- 先用 `AiUser.email` 关联过滤（不需要手写 JOIN）
- `deletedAt: null`
- `orderBy: { updatedAt: "desc" }`
- `take: limit`
- `select` 映射出同名字段（并做别名转换）

伪代码：

```ts
const sessions = await prisma.aiSession.findMany({
  where: {
    deletedAt: null,
    user: { email },
  },
  orderBy: [{ updatedAt: "desc" }],
  take: limit,
  select: {
    id: true,
    topic: true,
    memoryPrompt: true,
    messages: true,
    tokenCount: true,
    wordCount: true,
    charCount: true,
    updatedAt: true,
    lastSummarizeIndex: true,
    clearContextIndex: true,
  },
});

return sessions.map((s) => ({
  id: s.id,
  topic: s.topic,
  memoryPrompt: s.memoryPrompt,
  messages: s.messages,
  tokenCount: s.tokenCount,
  wordCount: s.wordCount,
  charCount: s.charCount,
  lastUpdate: s.updatedAt,
  lastSummarizeIndex: s.lastSummarizeIndex,
  clearContextIndex: s.clearContextIndex,
}));
```

> 注意：Prisma 的 `BigInt` JSON 序列化会有坑（JS `BigInt` 不能直接 `JSON.stringify`）。建议在 response 中将 `id` 转成 string，或启用自定义序列化。你给的 SQL 返回 `id` 是数字，但在 JS/JSON 层面建议输出 string 更安全。

**建议的返回字段类型（更稳）**
- `id: string`（由 `BigInt` 转 string）

## 6. Prisma 生成与运行流程（建议写进你自己的部署文档）

因为仓库目前没有 Prisma 脚本，推荐在后续落地时补齐：

- 初始化：`yarn prisma init`
- 生成 client：`yarn prisma generate`

可选：在 `package.json` 增加
- `"postinstall": "prisma generate"`

> 这一步是否要加要看你的 CI/CD 与部署平台（有些平台会在 install 阶段运行 postinstall，有些会跳过）。

## 7. 待你确认的问题（建议你在此文档直接改）

1) 鉴权模式选 A（自查询）还是 B（管理员）？
2) API 路径倾向：`/api/mysql/sessions/by-email`（POST）还是 `/api/mysql/sessions`（GET）？
3) `id` 在 response 中是否允许用 string（推荐），否则需要额外的 BigInt JSON 处理。
4) 数据库连接是否与现有 `docker-compose` 的 `DATABASE_URL` 共存？如果共存，请确认最终环境变量命名与注入方式。

---

如果你确认以上方案，我可以按这个文档直接把对应代码（Prisma schema、client 封装、route handler）落到仓库里，并补一条最小可运行的本地环境变量说明。