#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ANALYSIS_JSON = path.join(process.cwd(), ".analysis/tsmorph-analysis.json");
const OUT_DIR = path.join(process.cwd(), "docs/analysis");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function chunkText(text, maxChars = 16000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

function summarizeFunction(fn) {
  return `- **${fn.name}** (exported: ${fn.isExported})  
  - params: ${fn.params.map(p => `${p.name}: ${p.type}`).join(', ')}  
  - return: ${fn.returnType}  
  - lines: ${fn.start}-${fn.end}  
  ${fn.jsDocs && fn.jsDocs.length ? `  - docs: ${fn.jsDocs.join(' | ')}` : ''}\n`;
}

function buildIndex(data) {
  const files = data.results;
  let md = `# Analysis Index\n\nGenerated: ${data.generatedAt}\n\n`;
  md += "## Files\n\n";
  for (const f of files) {
    md += `- ${f.filePath} — ${f.functions.length} functions, ${f.classes.length} classes\n`;
  }
  md += "\n## Documents\n\n";
  md += `- overview-by-file.md — 按文件汇总函数/类列表\n`;
  md += `- overview-by-function.md — 按函数索引 (输入/输出摘要)\n`;
  md += `- io-matrix.md — 模块/函数 I/O 摘要矩阵\n`;
  return md;
}

function buildByFile(data) {
  let md = `# Overview By File\n\nGenerated: ${data.generatedAt}\n\n`;
  for (const f of data.results) {
    md += `## ${f.filePath}\n\n`;
    if (f.exports && f.exports.length) md += `- exports: ${f.exports.join(', ')}\n`;
    if (f.imports && f.imports.length) md += `- imports: ${f.imports.join(', ')}\n`;
    md += `\n### Functions\n\n`;
    for (const fn of f.functions) md += summarizeFunction(fn);
    if (f.classes && f.classes.length) {
      md += `\n### Classes\n\n`;
      for (const c of f.classes) {
        md += `- **${c.name}** (lines ${c.start}-${c.end})\n`;
        for (const m of c.methods) md += `  - ${m.name}(${m.params.map(p => p.name).join(', ')}) => ${m.returnType} (lines ${m.start}-${m.end})\n`;
      }
    }
    md += `\n`;
  }
  return md;
}

function buildByFunction(data) {
  let md = `# Overview By Function\n\nGenerated: ${data.generatedAt}\n\n`;
  const list = [];
  for (const f of data.results) {
    for (const fn of f.functions) {
      list.push({ file: f.filePath, fn });
    }
    for (const c of f.classes) {
      for (const m of c.methods) list.push({ file: f.filePath, fn: { name: `${c.name}.${m.name}`, isExported: c.isExported, params: m.params, returnType: m.returnType, start: m.start, end: m.end, jsDocs: m.jsDocs } });
    }
  }
  // sort by file then name
  list.sort((a, b) => a.file.localeCompare(b.file) || a.fn.name.localeCompare(b.fn.name));
  for (const it of list) {
    md += `- **${it.fn.name}** — file: ${it.file}  \n  - params: ${it.fn.params.map(p => `${p.name}: ${p.type}`).join(', ')}  \n  - return: ${it.fn.returnType}  \n  - lines: ${it.fn.start}-${it.fn.end}  \n  ${it.fn.jsDocs && it.fn.jsDocs.length ? `  - docs: ${it.fn.jsDocs.join(' | ')}` : ''}\n`;
  }
  return md;
}

function buildIOMatrix(data) {
  let md = `# IO Matrix (approximate)\n\nGenerated: ${data.generatedAt}\n\n`;
  md += `This matrix lists functions and their parameter/return type texts (as extracted).\n\n`;
  for (const f of data.results) {
    md += `## ${f.filePath}\n\n`;
    for (const fn of f.functions) {
      md += `- ${fn.name}: (${fn.params.map(p => p.type).join(', ')}) => ${fn.returnType}\n`;
    }
    for (const c of f.classes) {
      for (const m of c.methods) md += `- ${c.name}.${m.name}: (${m.params.map(p => p.type).join(', ')}) => ${m.returnType}\n`;
    }
    md += `\n`;
  }
  return md;
}

function writeChunked(nameBase, content) {
  const chunks = chunkText(content, 14000);
  const files = [];
  chunks.forEach((c, idx) => {
    const name = idx === 0 ? `${nameBase}.md` : `${nameBase}.part${idx + 1}.md`;
    fs.writeFileSync(path.join(OUT_DIR, name), c, "utf-8");
    files.push(name);
  });
  return files;
}

function main() {
  if (!fs.existsSync(ANALYSIS_JSON)) {
    console.error('Missing analysis JSON. Run tools/tsmorph-analyze.mjs first.');
    process.exit(1);
  }
  ensureDir(OUT_DIR);
  const data = JSON.parse(fs.readFileSync(ANALYSIS_JSON, 'utf-8'));

  // Index
  const index = buildIndex(data);
  fs.writeFileSync(path.join(OUT_DIR, 'index.md'), index);

  const byFile = buildByFile(data);
  writeChunked('overview-by-file', byFile);

  const byFn = buildByFunction(data);
  writeChunked('overview-by-function', byFn);

  const io = buildIOMatrix(data);
  writeChunked('io-matrix', io);

  console.log('Docs written to docs/analysis/');
}

main();
