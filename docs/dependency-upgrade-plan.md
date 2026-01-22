# 项目依赖升级方案（AI/NextChat）

更新时间：2026-01-19
适用范围：Web（Next.js）、桌面端（Tauri）、后端与构建（Prisma、Docker、CI）

---

## 目标与原则

- 稳步升级至受支持且长期维护（LTS）的版本，优先解决安全与性能问题。
- 保持行为兼容，分阶段渐进式升级，每阶段均有可验证的完成标准与回滚方案。
- 遵循 Vercel React Best Practices（性能优先，避免数据获取瀑布、控制 bundle 体积、合理 Suspense）。

---

## 现状审计摘要

- 核心框架
  - Next.js：`^14.1.1`（见 [package.json](../package.json)）
  - React/ReactDOM：`^18.2.0`
  - TypeScript：`5.2.2`（pin 固定）
  - ESLint/Config：`eslint@^8.49.0`、`eslint-config-next@13.4.19`（与 Next 14 不匹配，建议对齐）
- 数据与后端
  - Prisma：`^4.16.1`（client 与 CLI），[schema](../prisma/schema.prisma) 连接 MySQL（`AI_MYSQL_URL`）
- 测试与工具
  - Jest：`^29.7.0`，配置见 [jest.config.ts](../jest.config.ts)
- 构建与运行
  - Docker：基础镜像 `node:20-alpine`（见 [Dockerfile](../Dockerfile)），生产打包使用 Next `standalone` 输出
  - Next 配置：见 [next.config.mjs](../next.config.mjs)，有 `experimental.forceSwcTransforms` 与自定义 `webpack` 配置
- 桌面端
  - Tauri：Rust 侧 `tauri = 1.5.4`（见 [src-tauri/Cargo.toml](../src-tauri/Cargo.toml)），JS 侧 `@tauri-apps/api@^2.1.1`、`@tauri-apps/cli@1.5.11`（版本代际不一致，存在风险）
- 依赖管理
  - 包管理器：`yarn@1.22.19`（Yarn Classic）

关键风险与不一致：
- `eslint-config-next@13.4.19` 与 `next@^14.1.1` 不匹配，应对齐版本。
- Tauri JS API（v2）与 Rust tauri（v1.5）版本不一致，需统一到同一大版本（建议统一至 v2，或回退 JS API 至 v1）。

---

## 版本目标建议

- Node.js：升级至 LTS `22.x`（Docker 基础镜像），保留对 `20.x` 的兼容测试。
- Next.js：升级至 `16.x`（启用 Cache Components 模式，按官方迁移指南），对齐 `eslint-config-next@^16.x`。
- React：升级至 `19.x`（与 Next 16 对齐），并验证第三方库兼容性（Testing Library、SWR 等）。
- TypeScript：升级至 `^5.6.x`（或最新稳定版），保持 `ES2022/ES2023` 目标按需调整。
- Prisma：升级至 `^5.x`（CLI 与 client 同步），重新 `generate` 并进行 schema 兼容性检查。
- Tauri：优先统一至 v2：`tauri@2.x` + `@tauri-apps/api@^2.x` + `@tauri-apps/cli@^2.x`；如短期风险较高，则统一回退至 v1。
- Jest：保持 `^29/30`（若追求更快开发反馈，可评估迁移到 Vitest）。
- 其它库：`sass`、`axios`、`zod`、`zustand` 等常用库提升至最新次要/修正版。

---

## 分阶段升级计划

### 阶段 0：准备与审计（1 天）
- 建立升级分支：`chore/dep-upgrade-2026Q1`，启用 CI 执行 `lint/test/build`。
- 全量依赖报告：使用 `npm-check-updates (ncu)` 生成升级差异与潜在重大变更清单。

```bash
# Yarn Classic 项目可直接使用 npx
npx npm-check-updates
npx npm-check-updates -u

yarn install
```

### 阶段 1：工具链对齐（1-2 天）
- TypeScript、ESLint、`eslint-config-next`、`@types/node` 升级并对齐。
- 修复基础 lint/type 问题，确保 `yarn build` 与 `yarn test` 通过。

```bash
yarn add -D typescript@latest eslint@latest eslint-config-next@latest @types/node@latest

yarn lint
yarn test:ci
```

### 阶段 2：Next.js → 16 与 React → 19（2-4 天）
- 升级 Next 与 React 版本，执行官方 codemod（若使用 MCP 工具，优先使用“Next.js 16 Upgrade”），清理不兼容实验旗标。
- 在 [next.config.mjs](../next.config.mjs) 中：
  - 去除或更新 `experimental.forceSwcTransforms`（如在 16 不再需要/兼容则移除）。
  - 启用 Cache Components（在 16.0.0 为 `experimental.cacheComponents: true`，在更高版本可能为稳定 `cacheComponents: true`）。
  - 保持 `webpack` 自定义最小化（`LimitChunkCountPlugin` 与 SVG loader 如仍需要则保留）。
- 验证路由、重写与 headers 配置行为不变。

```bash
yarn add next@^16 react@^19 react-dom@^19 @next/third-parties@latest eslint-config-next@^16

# 如官方提供 codemod：
# npx @next/codemod@latest <16_upgrade_codename>  # 参考文档/工具输出

yarn dev
yarn build
```

性能注意（来自 Vercel Best Practices）：
- 引入 `next/dynamic` 对沉重组件按需加载（Monaco 等）。
- 避免 barrel imports（可评估 `experimental.optimizePackageImports`）。
- 在布局中增加合理 `Suspense` 边界，避免数据获取阻塞整体渲染。

### 阶段 3：Prisma → 5（1-2 天）
- 升级 Prisma CLI 与 client 到 5.x，重新生成 client 并回归 MySQL 读写路径。
- 检查 `schema.prisma` 的兼容性与迁移注意点（特别是中间件与扩展 API 变更）。

```bash
yarn add prisma@latest @prisma/client@latest

yarn prisma:generate
# 可选：yarn prisma migrate status
```

### 阶段 4：Tauri 统一版本（2-5 天）
- 选型 A（推荐，长期）：统一到 Tauri v2
  - Rust：将 [src-tauri/Cargo.toml](../src-tauri/Cargo.toml) 的 `tauri = "2.x"`，升级相关插件（`tauri-plugin-window-state` 需替换为 v2 等效）。
  - JS：保持 `@tauri-apps/api@^2.x`、升级 `@tauri-apps/cli@^2.x`。
  - 更新 [src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json) 中的 v2 配置项（若有）。
- 选型 B（短期风险最小）：统一到 Tauri v1
  - JS：回退 `@tauri-apps/api` 至 `^1.5.x`，保持 CLI `1.5.x`。

```bash
# 升级 Rust 工具链
rustup update stable

# JS 侧（示例为统一到 v2）
yarn add -D @tauri-apps/cli@^2.0.0
# 如需回退到 v1：yarn add -D @tauri-apps/api@^1.5.0

# 验证桌面端开发与打包
yarn app:dev
yarn app:build
```

### 阶段 5：测试与构建体系（1-2 天）
- Jest 维持 `29/30` 并对齐 `jest-environment-jsdom`；可选评估迁移到 Vitest（更快、更现代）。
- 保持 [jest.config.ts](../jest.config.ts) 中的 `next/jest` 集成。

```bash
# 保持 Jest
yarn add -D jest@latest jest-environment-jsdom@latest @testing-library/react@latest @testing-library/jest-dom@latest

yarn test:ci

# 可选：迁移到 Vitest
# yarn add -D vitest @vitest/coverage-v8 jsdom
# 更新 test 脚本与配置，然后运行：
# yarn vitest run --coverage
```

### 阶段 6：容器与部署（0.5-1 天）
- Docker 基础镜像升级到 `node:22-alpine`，同时保留与 `node:20-alpine` 的回滚路径。
- 验证 Next `standalone` 输出结构是否在 16 保持一致（`server.js`、`.next/standalone`），按需调整拷贝路径。

```diff
- FROM node:20-alpine AS base
+ FROM node:22-alpine AS base
```

```bash
docker build -t nextchat:upgrade .
docker run --rm -p 3000:3000 nextchat:upgrade
```

---

## 验证准则

- 构建：`yarn build` 成功，输出结构正确，`standalone`/`export` 模式按需验证。
- 开发：`yarn dev` 无编译错误，路由/重写/Headers 行为与预期一致。
- 测试：`yarn test:ci` 通过，覆盖率不下降（或有明确说明）。
- 桌面端：`yarn app:dev`、`yarn app:build` 成功运行。
- 性能：按关键路径引入 `Suspense`、`next/dynamic`，避免 barrel imports；对重型第三方库做延迟加载。

---

## 回滚策略

- Git 分支与标签：每阶段完成后打标签（如 `v2026.01-phase2`）。
- 依赖锁定：保留 `yarn.lock` 旧版本，必要时快速 `git checkout` 回退。
- 容器：保留旧镜像（Node 20）与新镜像（Node 22），部署层面可灰度切换。

---

## 监控与维护

- 安全审计：开启 Dependabot/ Renovate（或 CI 任务）监控安全更新。
- Prometheus：如需对 Web/桌面端新增指标，可在 [prometheus.yml](../prometheus.yml) 基础上添加自定义 exporter。
- 性能守护：对关键路由建立 Web Vitals 上报（LCP/TTI），并在页面/组件层面应用 Best Practices。

---

## 附录：推荐命令与检查清单

- 快速升级并安装
```bash
npx npm-check-updates -u
yarn install
```
- 基础检查
```bash
yarn lint
yarn test:ci
yarn build
yarn dev
```
- Prisma
```bash
yarn prisma:generate
# 可选：yarn prisma migrate status
```
- 桌面端
```bash
yarn app:dev
yarn app:build
```

### 代码层面最佳实践（摘自 Vercel React Best Practices）
- 避免数据获取瀑布：优先 `Promise.all()`，或用依赖并行化工具；在 API 路由中“先启动、后等待”。
- 控制 bundle 体积：避免 barrel imports，重型组件用 `next/dynamic` 按需加载；将分析/日志类库延迟到水合后。
- 合理的 Suspense 边界：使布局尽早可见，将数据渲染区与框架外壳解耦；共享 Promise 避免重复请求。

---

## 执行建议

1. 先落地阶段 0-1（工具链与基础对齐），确保构建/测试稳定。
2. 再进行阶段 2（Next/React 大版本升级），结合官方迁移指南与 codemod。
3. 之后推进 Prisma 与 Tauri 统一，最后完成容器与部署升级。
4. 全程在升级分支进行，阶段性合入主分支并做灰度验证。
