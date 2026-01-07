# Prisma + MariaDB：获取用户 Sessions 接口设计

> 目的：在现有 NextChat（Next.js App Router）项目中新增一个 API 接口，从 MariaDB/MySQL 的 `ai_users` / `ai_sessions` 表中按用户 email 读取最近的 sessions，返回结果与给定 SQL 的字段一致。
>
> 约束：必须使用 `prisma@^7.2.0` 与 `@prisma/client@^7.2.0`（项目已存在依赖）。

## 1. 现状评估（基于当前仓库）

- 路由形态：项目使用 Next.js App Router API Routes，路径位于 `app/api/**/route.ts`，并普遍导出 `export const runtime = "nodejs"`（例如 `app/api/budget/route.ts`）。
- 鉴权形态：项目已有 Azure AD/JWT 鉴权实现 `app/api/auth.ts`。
  - 複用 `app/api/auth.ts` 的 `getUsernameByToken(token)`，用于仅解析 token 并得到 email
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

接口输出：上述 SELECT 的结果数组。

## 3. API 方案设计

### 3.1 路径与方法

新增：

- `GET /api/mysql/sessions`

### 3.2 Request / Response Contract

**Request**

req.headers.get("Authorization") // Bearer token
`email` (通過Auth getUsernameByToken(token)獲取)

- `email`: 必填，标准 email。

**Response(JSON)**

### 3.3 鉴权与授权（必须明确的决策点）

- `403`: auth 獲取email失敗返回 `403`。
- `200`: 成功（即使没找到用户，也返回 `[]`）。
- `500`: 数据库连接/查询异常。

## 4. Prisma 数据层设计

### 4.1 Prisma datasource

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
- `app/lib/prisma.ts`（按你项目现有目录习惯选一个）

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
- `app/api/sessions/route.ts`

并确保：
- `export const runtime = "nodejs";`

### 5.2 参数校验

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
  stat: {
    tokenCount: s.tokenCount,
    wordCount: s.wordCount,
    charCount: s.charCount,
  }
  lastUpdate: s.updatedAt,
  lastSummarizeIndex: s.lastSummarizeIndex,
  clearContextIndex: s.clearContextIndex,
}));
```

> 注意：在 response 中将 `id` 转成 string

**返回字段类型**
- `id: string`（由 `BigInt` 转 string）

## 6. Prisma 生成与运行流程（建议写进你自己的部署文档）

因为仓库目前没有 Prisma 脚本，推荐在后续落地时补齐：

- 初始化：`yarn prisma init`
- 生成 client：`yarn prisma generate`
