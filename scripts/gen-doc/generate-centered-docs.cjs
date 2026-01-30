#!/usr/bin/env node
/*
Generate project documentation centered on a chosen entry file.
Usage: node scripts/generate-centered-docs.cjs [entryPath]
If no entryPath provided, defaults to 'app/layout.tsx' or 'app/page.tsx'.
Outputs: docs/CenteredDocs/*
*/

const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'docs', 'CenteredDocs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const entryArg = process.argv[2];
const CANDIDATES = [entryArg, 'app/layout.tsx', 'app/page.tsx', 'app/page.ts', 'app/layout.ts'];

const project = new Project({ tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json') });
project.addSourceFilesAtPaths(['app/**/*.{ts,tsx,js,jsx}', 'components/**/*.{ts,tsx,js,jsx}', 'client/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,tsx,js,jsx}', 'src/**/*.{ts,tsx,js,jsx}']);

function truncate(s, n = 240) { if (!s) return ''; return s.length > n ? s.slice(0, n) + '...' : s; }

function write(name, content) { fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8'); console.log('Wrote', path.relative(process.cwd(), path.join(OUT_DIR, name))); }

function findEntry() {
  for (const cand of CANDIDATES) {
    if (!cand) continue;
    const abs = path.resolve(process.cwd(), cand);
    const sf = project.getSourceFile(abs) || project.getSourceFile((p) => p.getFilePath() === abs);
    if (sf) return sf;
    // try relative match by ending
    const sf2 = project.getSourceFiles().find((s) => s.getFilePath().endsWith(cand));
    if (sf2) return sf2;
  }
  // fallback: pick a top-level app file
  const appFiles = project.getSourceFiles().filter((s) => s.getFilePath().includes(path.sep + 'app' + path.sep));
  return appFiles[0] || project.getSourceFiles()[0];
}

function buildImportGraph(startSf) {
  const visited = new Set();
  const queue = [startSf];
  const files = [];
  while (queue.length) {
    const sf = queue.shift();
    if (!sf) continue;
    const fp = sf.getFilePath();
    if (visited.has(fp)) continue;
    visited.add(fp);
    files.push(sf);
    const imports = sf.getImportDeclarations();
    for (const imp of imports) {
      try {
        const target = imp.getModuleSpecifierSourceFile && imp.getModuleSpecifierSourceFile();
        if (target) queue.push(target);
      } catch (e) {}
    }
    // also follow re-exports
    const exports = sf.getExportDeclarations();
    for (const ex of exports) {
      try {
        const target = ex.getModuleSpecifierSourceFile && ex.getModuleSpecifierSourceFile();
        if (target) queue.push(target);
      } catch (e) {}
    }
  }
  return files;
}

function summarizeFile(sf) {
  const rel = path.relative(process.cwd(), sf.getFilePath()).replace(/\\\\/g, '/');
  const lines = [];
  lines.push('## `' + rel + '`');
  try {
    const exports = (sf.getExportSymbols ? sf.getExportSymbols().map((s) => s.getName()) : []);
    lines.push('\n**Exports:** ' + (exports.length ? exports.join(', ') : '(none)') + '\n');
  } catch (e) { lines.push('\n**Exports:** (error)\n'); }

  const functions = sf.getFunctions();
  for (const fn of functions) {
    const name = fn.getName() || '<anonymous>';
    const params = fn.getParameters().map((p) => p.getName() + ': ' + (p.getType && p.getType().getText ? truncate(p.getType().getText(), 200) : '(unknown)'));
    const ret = (fn.getReturnType && fn.getReturnType().getText) ? truncate(fn.getReturnType().getText(), 200) : '(unknown)';
    lines.push('### function `' + name + '(' + params.join(', ') + ') => ' + ret + '`');
  }

  const vars = sf.getVariableStatements();
  for (const vs of vars) {
    for (const dec of vs.getDeclarations()) {
      const init = dec.getInitializer && dec.getInitializer();
      if (init && ((init.getKind && init.getKind() === SyntaxKind.ArrowFunction) || (init.getKind && init.getKind() === SyntaxKind.FunctionExpression))) {
        const name = dec.getName();
        lines.push('### const `' + name + '` (fn)');
      }
    }
  }

  const interfaces = sf.getInterfaces();
  for (const itf of interfaces) {
    lines.push('### interface `' + itf.getName() + '`');
    for (const p of itf.getProperties()) lines.push('- `' + p.getName() + ': ' + (p.getType && p.getType().getText ? truncate(p.getType().getText(), 200) : '(unknown)') + '`');
  }

  return lines.join('\n') + '\n\n---\n';
}

function findReferences(symDecls, originPath) {
  const refs = [];
  for (const sf of project.getSourceFiles()) {
    if (path.resolve(sf.getFilePath()) === path.resolve(originPath)) continue;
    const ids = sf.getDescendantsOfKind(SyntaxKind.Identifier);
    for (const id of ids) {
      try {
        const idSym = id.getSymbol && id.getSymbol();
        if (!idSym) continue;
        const idDecls = idSym.getDeclarations();
        if (idDecls.some((d) => symDecls.includes(d))) {
          refs.push({ file: sf.getFilePath(), line: id.getStartLineNumber(), text: truncate(id.getParent().getText(), 200) });
        }
      } catch (e) {}
    }
  }
  return refs;
}

async function run() {
  const entry = findEntry();
  if (!entry) { console.error('No entry file found'); process.exit(1); }
  console.log('Using entry:', path.relative(process.cwd(), entry.getFilePath()));

  const reachable = buildImportGraph(entry);
  const overview = [];
  overview.push('# Project — Centered docs');
  overview.push('**Entry:** `' + path.relative(process.cwd(), entry.getFilePath()) + '`');
  overview.push('**Reachable files:** ' + reachable.length);
  overview.push('\n---\n');

  write('overview.md', overview.join('\n'));

  // structure.md: summarize each reachable file
  const structLines = ['# Structure — files reachable from entry\n'];
  for (const sf of reachable) structLines.push(summarizeFile(sf));
  write('structure.md', structLines.join('\n'));

  // references: collect top-level exported symbols from entry file and find references
  const entryExports = entry.getExportSymbols ? entry.getExportSymbols() : [];
  const refLines = ['# References to entry exports\n'];
  for (const ex of entryExports) {
    try {
      const name = ex.getName();
      const decls = ex.getDeclarations ? ex.getDeclarations() : [];
      const refs = findReferences(decls, entry.getFilePath());
      refLines.push('## ' + name + ' — ' + refs.length + ' references');
      for (const r of refs.slice(0, 50)) {
        refLines.push('- `' + path.relative(process.cwd(), r.file) + '` line ' + r.line + ': `' + r.text.replace(/\n/g, ' ') + '`');
      }
      refLines.push('');
    } catch (e) {}
  }
  write('references.md', refLines.join('\n'));

  console.log('Docs written to', OUT_DIR);
}

run().catch((e) => { console.error('Error:', e); process.exit(1); });
