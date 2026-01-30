import fs from "fs/promises";
import path from "path";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function safeFileName(p) {
  return p.replace(/[^a-z0-9_.-]/gi, "_").replace(/\/+/, "_");
}

async function main() {
  const root = process.cwd();
  const analysisPath = path.join(root, ".analysis/tsmorph-analysis.json");
  const outDir = path.join(root, "docs/generated");
  await ensureDir(outDir);
  const functionsDir = path.join(outDir, "functions");
  await ensureDir(functionsDir);
  // clear previously generated per-file docs to avoid stale files
  try {
    const existing = await fs.readdir(functionsDir);
    for (const f of existing) {
      await fs.unlink(path.join(functionsDir, f));
    }
  } catch (e) {
    // ignore
  }

  const raw = await fs.readFile(analysisPath, "utf8");
  const data = JSON.parse(raw);
  const results = data.results || [];

  // Top-level directory grouping
  const groups = new Map();
  let totalFiles = 0;
  let totalExports = 0;
  let totalFunctions = 0;
  let totalClasses = 0;

  const apiRoutes = [];
  const components = [];
  const pages = [];

  let skippedFiles = [];
  for (const file of results) {
    totalFiles += 1;
    const filePath = file.filePath || file.path || "";
    const top = (filePath.split("/")[0] || "root");
    groups.set(top, (groups.get(top) || 0) + 1);

    const fcount = (file.functions || []).length;
    const ccount = (file.classes || []).length;
    const ecount = (file.exports || []).length;
    totalFunctions += fcount;
    totalClasses += ccount;
    totalExports += ecount;

    // heuristics
    if (filePath.startsWith("app/api/")) {
      apiRoutes.push({ filePath, exports: file.exports || [], functions: file.functions || [] });
    }
    if (filePath.startsWith("app/components/") || filePath.includes("/components/")) {
      components.push({ filePath, exports: file.exports || [], functions: file.functions || [] });
    }
    if (filePath === "app/page.tsx" || filePath === "app/layout.tsx" || filePath.endsWith("page.tsx") || filePath.endsWith("layout.tsx")) {
      pages.push({ filePath, exports: file.exports || [], functions: file.functions || [] });
    }

    // decide whether to generate per-file summary (allowlist / denylist)
    const includePrefixes = [
      "app/api/",
      "app/store/",
      "app/auth/",
      "app/client/",
      "app/config/",
      "app/utils/",
      "app/",
    ];

    const includeExact = [
      "app/client/api.ts",
      "app/components/chat.tsx",
      "app/components/ui-lib.tsx",
      "app/utils.ts",
      "app/constant.ts",
      "app/layout.tsx",
      "app/page.tsx",
      "app/api/openai.ts",
      "app/api/openaiimage.ts",
      "app/api/auth.ts",
    ];

    const excludePrefixes = [
      "app/locales",
      "app/masks",
      "app/mcp",
      "app/components/sd",
      "app/components/voice-print",
      "app/client/platforms/tencent",
      "app/utils/tencent.ts.md",
      "app/utils/baidu.ts",
      "app/components/realtime-chat",
    ];

    // regex-based excludes for broader patterns (mask, mcp, cloud, etc.)
    const excludeRegex = [
      /\bmask(s?)\b/i,
      /\bbaidu\b/i,
      /\btencent\b/i,
      /\bcloud\b/i,
      /\bmcp\b/i,
      /\bcloud\b/i,
    ];

    const excludeExact = [
      "app/api/302ai.ts",
      "app/api/alibaba.ts",
      "app/api/anthropic.ts",
      "app/api/artifacts/route.ts",
      "app/api/azure.ts",
      "app/api/baidu.ts",
      "app/api/budget/route.ts",
      "app/api/bytedance.ts",
      "app/api/deepseek.ts",
      "app/api/glm.ts",
      "app/api/google.ts",
      "app/api/iflytek.ts",
      "app/api/moonshot.ts",
      "app/api/proxy.ts",
      "app/api/siliconflow.ts",
      "app/api/stability.ts",
      "app/api/tencent/route.ts",
      "app/api/upstash/[action]/[...key]/route.ts",
      "app/api/webdav/[...path]/route.ts",
      "app/api/xai.ts",
    ];

    // exclude client platform provider files (these are noisy for agent overview)
    const clientPlatformExcludes = [
      "app/client/platforms/302ai.ts",
      "app/client/platforms/ai302.ts",
      "app/client/platforms/alibaba.ts",
      "app/client/platforms/anthropic.ts",
      "app/client/platforms/artifacts/route.ts",
      "app/client/platforms/azure.ts",
      "app/client/platforms/baidu.ts",
      "app/client/platforms/budget/route.ts",
      "app/client/platforms/bytedance.ts",
      "app/client/platforms/deepseek.ts",
      "app/client/platforms/glm.ts",
      "app/client/platforms/google.ts",
      "app/client/platforms/google_bak.ts",
      "app/client/platforms/iflytek.ts",
      "app/client/platforms/moonshot.ts",
      "app/client/platforms/proxy.ts",
      "app/client/platforms/siliconflow.ts",
      "app/client/platforms/stability.ts",
      "app/client/platforms/tencent/route.ts",
      "app/client/platforms/upstash/[action]/[...key]/route.ts",
      "app/client/platforms/webdav/[...path]/route.ts",
      "app/client/platforms/xai.ts",
    ];

    // merge into excludeExact
    for (const p of clientPlatformExcludes) {
      if (!excludeExact.includes(p)) excludeExact.push(p);
    }

    // normalize path variants (some entries may use '_' instead of '/')
    const pPath = filePath.includes("/") ? filePath : filePath.replace(/_/g, "/");

    const isExcludedExact = excludeExact.includes(filePath) || excludeExact.includes(pPath);
    const isExcludedRegex = excludeRegex.some((re) => re.test(filePath) || re.test(pPath));
    const shouldInclude =
      !isExcludedExact &&
      !isExcludedRegex &&
      (includeExact.includes(filePath) || includeExact.includes(pPath) ||
        includePrefixes.some((p) => filePath.startsWith(p) || pPath.startsWith(p))) &&
      !excludePrefixes.some((p) => filePath.startsWith(p) || pPath.startsWith(p));

    // write per-file function summary only when included
    const shortMd = [];
    if (!shouldInclude) {
      // record skipped files for later summary
      skippedFiles = skippedFiles || [];
      skippedFiles.push(filePath);
      continue;
    }
    shortMd.push(`# ${filePath}\n`);
    shortMd.push(`- exports: ${JSON.stringify(file.exports || [])}`);
    shortMd.push(`- imports: ${JSON.stringify(file.imports || [])}`);
    shortMd.push(`- callExpressions (sample): ${JSON.stringify((file.callExpressions || []).slice(0, 10))}`);
    shortMd.push(`\n## Functions`);
    for (const fn of (file.functions || [])) {
      shortMd.push(`### ${fn.name}`);
      shortMd.push(`- exported: ${fn.isExported}`);
      if (fn.params) {
        shortMd.push(`- params: ${fn.params.map((p) => `${p.name}: ${p.type}`).join(", ")}`);
      }
      if (fn.returnType) shortMd.push(`- returns: ${fn.returnType}`);
      if (fn.bodyPreview) shortMd.push(`- preview:`);
      const preview = String(fn.bodyPreview || "").replace(/```/g, "`` `");
      shortMd.push("\n```\n");
      shortMd.push(preview.slice(0, 800));
      shortMd.push("\n```\n");
    }

    const fileName = safeFileName(filePath) + ".md";
    await fs.writeFile(path.join(functionsDir, fileName), shortMd.join("\n"), "utf8");
  }

  // write skipped files list if any
  if (typeof skippedFiles !== "undefined" && skippedFiles.length > 0) {
    await fs.writeFile(path.join(outDir, "skipped-files.txt"), skippedFiles.join("\n"), "utf8");
  }

  // architecture.md
  const arch = [];
  arch.push("# Project Architecture Summary\n");
  arch.push(`- generatedAt: ${data.generatedAt || new Date().toISOString()}`);
  arch.push(`- totalFiles: ${totalFiles}`);
  arch.push(`- totalExports: ${totalExports}`);
  arch.push(`- totalFunctions: ${totalFunctions}`);
  arch.push(`- totalClasses: ${totalClasses}`);
  arch.push("\n## Top-level groups\n");
  for (const [k, v] of groups.entries()) {
    arch.push(`- ${k}: ${v} files`);
  }

  arch.push("\n## Key areas (heuristics)\n");
  arch.push(`- API routes (app/api): ${apiRoutes.length} files`);
  arch.push(`- Components (app/components or */components): ${components.length} files`);
  arch.push(`- Pages/layouts: ${pages.length} files`);

  arch.push("\n## Likely entry points\n");
  const entryCandidates = [];
  const entryFiles = [
    "app/layout.tsx",
    "app/page.tsx",
    "server-https.js",
    "next.config.mjs",
    "package.json",
    "Dockerfile",
  ];
  for (const f of entryFiles) {
    const exists = results.find((r) => r.filePath === f);
    if (exists) entryCandidates.push(f);
  }
  // add most exported files
  const mostExported = [...results].sort((a, b) => (b.exports?.length || 0) - (a.exports?.length || 0)).slice(0, 8).map(r => r.filePath);
  arch.push(...entryCandidates.map(e => `- ${e}`));
  arch.push("\n## Files with most exports (top 8)\n");
  arch.push(...mostExported.map(f => `- ${f}`));

  await fs.writeFile(path.join(outDir, "architecture.md"), arch.join("\n"), "utf8");

  // entrypoints.md
  const entry = [];
  entry.push("# Entrypoints & API Routes\n");
  entry.push("## app/api routes (file -> exports)\n");
  for (const r of apiRoutes) {
    entry.push(`- ${r.filePath} -> exports: ${JSON.stringify(r.exports || [])}`);
  }
  entry.push("\n## pages/layouts\n");
  for (const p of pages) entry.push(`- ${p.filePath} -> exports: ${JSON.stringify(p.exports || [])}`);
  await fs.writeFile(path.join(outDir, "entrypoints.md"), entry.join("\n"), "utf8");

  // functions-index.json
  const funcIndex = results.map((r) => ({ filePath: r.filePath, exports: r.exports || [], functionsCount: (r.functions || []).length, classesCount: (r.classes || []).length }));
  await fs.writeFile(path.join(outDir, "tsmorph-summary.json"), JSON.stringify({ generatedAt: data.generatedAt, totals: { totalFiles, totalExports, totalFunctions, totalClasses }, groups: Object.fromEntries(groups), funcIndex }, null, 2), "utf8");

  // functions-overview.md
  const fo = [];
  fo.push("# Functions Overview\n");
  fo.push(`- total files: ${totalFiles}`);
  fo.push(`- total functions: ${totalFunctions}`);
  fo.push("\n## Top files by function count\n");
  const topByFn = [...results].sort((a, b) => (b.functions?.length || 0) - (a.functions?.length || 0)).slice(0, 20);
  for (const t of topByFn) {
    fo.push(`- ${t.filePath}: ${t.functions?.length || 0} functions, exports: ${JSON.stringify(t.exports || [])} `);
  }
  await fs.writeFile(path.join(outDir, "functions-overview.md"), fo.join("\n"), "utf8");

  // index.md
  const idx = [];
  idx.push("# Generated Code Intelligence Index\n");
  idx.push("本目录由 `scripts/analyze-tsmorph.mjs` 基于 `.analysis/tsmorph-analysis.json` 自动生成。建议给 AI Agent 使用以下文档作为理解项目的起点：\n");
  idx.push("- architecture.md: 高层架构与关键区域摘要\n- entrypoints.md: 识别的入口与 API 路由\n- tsmorph-summary.json: 结构化摘要，便于机器解析\n- functions-overview.md: 函数分布概览\n- functions/: 每个源码文件的导出/函数摘要，便于快速查找\n");
  idx.push("使用建议:\n");
  idx.push("1) 机器人首先读取 `tsmorph-summary.json` 获取索引信息; 2) 进一步读取 `entrypoints.md` 定位关键入口; 3) 对感兴趣的文件打开 `functions/<safe-file>.md` 查看函数签名与预览; 4) 若需要追踪调用链，可在 ts-morph 原始 JSON 中查询 `callExpressions` 字段。\n");
  await fs.writeFile(path.join(outDir, "index.md"), idx.join("\n"), "utf8");

  console.log("Generated docs in", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
