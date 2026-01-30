/*
CommonJS runner for the ts-morph doc generator (used for testing execution).
This mirrors the TypeScript script but uses plain JS so `node` can run it directly.
Usage: node scripts/ts-morph-docgen.cjs
*/

const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  rootDir: process.cwd(),
  include: [
    'app/**/*.{ts,tsx,js,jsx}',
    'components/**/*.{ts,tsx,js,jsx}',
    'client/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
    'api/**/*.{ts,tsx,js,jsx}',
    'src/**/*.{ts,tsx,js,jsx}',
    'public/**/*.{ts,tsx,js,jsx}',
    'next.config.mjs'
  ],
  exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**'],
  outFile: path.join(process.cwd(), 'docs/CodeStructure.md'),
  tsconfigPath: path.join(process.cwd(), 'tsconfig.json'),
  includeReferences: true,
  maxTypeTextLength: 300,
};

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '...' : s || '');

function safeTypeText(typeNode) {
  try {
    return truncate(typeNode.getText(), CONFIG.maxTypeTextLength);
  } catch (e) {
    try {
      return truncate(typeNode.getType().getText(), CONFIG.maxTypeTextLength);
    } catch (e) {
      return '(unable to resolve type)';
    }
  }
}

function getJSDocSummary(node) {
  try {
    const docs = node && node.getJsDocs ? node.getJsDocs() : [];
    if (!docs || docs.length === 0) return '';
    return docs.map((d) => (d.getComment ? d.getComment() : '') || '').join(' ').trim();
  } catch (e) {
    return '';
  }
}

function findReferencesAcrossProject(symbol, project, originFilePath) {
  const refs = [];
  if (!symbol) return refs;
  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath();
    if (path.resolve(sfPath) === path.resolve(originFilePath)) continue;
    const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
    for (const id of identifiers) {
      const idSymbol = id.getSymbol && id.getSymbol();
      if (!idSymbol) continue;
      const idDecls = idSymbol.getDeclarations();
      const symDecls = symbol.getDeclarations ? symbol.getDeclarations() : [];
      if (symDecls.some((sd) => idDecls.includes(sd))) {
        const p = id.getSourceFile().getFilePath();
        const l = id.getStartLineNumber ? id.getStartLineNumber() : 0;
        const col = id.getStartColumn ? id.getStartColumn() : 0;
        refs.push({ file: p, line: l, column: col, text: id.getText() });
      }
    }
  }
  return refs;
}

async function run() {
  const project = new Project({ tsConfigFilePath: CONFIG.tsconfigPath });
  project.addSourceFilesAtPaths(CONFIG.include);
  const sourceFiles = project.getSourceFiles().filter((sf) => !CONFIG.exclude.some((ex) => sf.getFilePath().includes(ex.replace('**/', ''))));

  // Load feature-map if available
  let featureMap = null;
  let yaml = null;
  let cfg = null;
  try {
    yaml = require('js-yaml');
  } catch (e) {
    // js-yaml not installed; fall back to default grouping
    yaml = null;
  }

  const featureMapPath = path.join(process.cwd(), 'config/feature-map.yml');
  try {
    if (yaml && fs.existsSync(featureMapPath)) {
      const raw = fs.readFileSync(featureMapPath, 'utf-8');
      cfg = yaml.load(raw);
      featureMap = cfg && cfg.features ? cfg.features : null;
    }
  } catch (e) {
    console.warn('Failed to load feature map:', e.message || e);
    featureMap = null;
  }

  // helpers for matching
  function globToRegex(glob) {
    let g = glob.replace(/[-\\^$+?.()|[\]{}]/g, (m) => '\\' + m);
    g = g.replace(/\\\*\\\*/g, '___DOUBLE_STAR___');
    g = g.replace(/\*/g, '[^/]*');
    g = g.replace(/\?/g, '.');
    g = g.replace(/___DOUBLE_STAR___/g, '.*');
    return new RegExp('^' + g + '$');
  }
  function matchAnyPattern(patterns, relPath) {
    if (!patterns || patterns.length === 0) return false;
    for (const p of patterns) {
      const r = globToRegex(p);
      if (r.test(relPath)) return true;
    }
    return false;
  }

  const groupMap = new Map();
  const assignmentReport = { ambiguous: [], unmatched: [] };

  function assignFeature(relPath, exportNames, text) {
    if (!featureMap) return null;
    const matches = [];
    for (let i = 0; i < featureMap.length; i++) {
      const f = featureMap[i];
      let score = 0;
      if (matchAnyPattern(f.paths || [], relPath)) score += 10;
      for (const ex of (f.exports || [])) {
        if (exportNames.includes(ex)) score += 5;
      }
      for (const kw of (f.keywords || [])) {
        if (kw && text && text.includes(kw)) score += 1;
      }
      if (score > 0) matches.push({ idx: i, score });
    }
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.score - a.score);
    if (matches.length > 1 && matches[0].score === matches[1].score) {
      assignmentReport.ambiguous.push({ path: relPath, matches: matches.map((m) => ({ name: featureMap[m.idx].name, score: m.score })) });
    }
    return featureMap[matches[0].idx].name;
  }

  for (const sf of sourceFiles) {
    const relPath = path.relative(CONFIG.rootDir, sf.getFilePath()).replace(/\\\\/g, '/');
    const exportSymbols = (sf.getExportSymbols ? sf.getExportSymbols().map((s) => s.getName()) : []);
    const text = sf.getFullText();

    let groupKey = null;
    if (featureMap) groupKey = assignFeature(relPath, exportSymbols, text) || (fs.existsSync(featureMapPath) ? cfg && cfg.fallback ? cfg.fallback : 'others' : 'others');
    else {
      const parts = relPath.split(path.sep);
      if (!parts || parts.length === 0) groupKey = 'others';
      else if (parts[0] === 'app' && parts[1] === 'api') groupKey = 'app-api';
      else {
        const allowed = ['app', 'components', 'client', 'lib', 'api', 'src', 'public', 'scripts'];
        groupKey = allowed.includes(parts[0]) ? parts[0] : 'others';
      }
    }

    if (!groupMap.has(groupKey)) {
      const gLines = [];
      gLines.push('# Code Structure — ' + groupKey + '\n');
      if (featureMap) {
        const fcfg = featureMap.find((f) => f.name === groupKey);
        if (fcfg && fcfg.description) gLines.push('> ' + fcfg.description + '\n');
      }
      gLines.push('This document is generated by a ts-morph script. It lists high-level structure, inputs/outputs and cross-file references.\n');
      gLines.push('**Config:**');
      gLines.push('- rootDir: ' + CONFIG.rootDir);
      gLines.push('- include: ' + JSON.stringify(CONFIG.include));
      gLines.push('- exclude: ' + JSON.stringify(CONFIG.exclude));
      gLines.push('- includeReferences: ' + CONFIG.includeReferences + '\n');
      gLines.push('---\n');
      groupMap.set(groupKey, gLines);
    }

    const lines = groupMap.get(groupKey);

    lines.push('## `' + relPath + '`');

    // Exports
    try {
      const exports = sf.getExportSymbols().map((s) => s.getName());
      lines.push('**Exports:** ' + (exports.length > 0 ? exports.join(', ') : '(none)') + '\n');
    } catch (e) {
      lines.push('**Exports:** (unable to read exports)\n');
    }

    // functions
    const functions = sf.getFunctions();
    for (const fn of functions) {
      const name = fn.getName() || '<anonymous>';
      const params = fn.getParameters().map((p) => p.getName() + ': ' + truncate(p.getType().getText(), CONFIG.maxTypeTextLength));
      const ret = truncate(fn.getReturnType().getText(), CONFIG.maxTypeTextLength);
      const jsdoc = getJSDocSummary(fn) || '';

      lines.push('### function `' + name + '(' + params.join(', ') + ') => ' + ret + '`');
      if (jsdoc && jsdoc.trim()) lines.push('- **JSDoc:** ' + jsdoc);
      lines.push('- **Inputs:**');
      if (params.length === 0) lines.push('  - (none)');
      else params.forEach((p) => lines.push('  - `' + p + '`'));
      lines.push('- **Output:** `' + ret + '`');

      if (CONFIG.includeReferences) {
        const sym = fn.getSymbol && fn.getSymbol();
        const refs = sym ? findReferencesAcrossProject(sym, project, sf.getFilePath()) : [];
        if (refs.length > 0) {
          lines.push('- **Referenced in:**');
          const byFile = {};
          for (const r of refs) {
            (byFile[r.file] = byFile[r.file] || []).push(r);
          }
          for (const f of Object.keys(byFile)) {
            lines.push('  - ' + path.relative(CONFIG.rootDir, f) + ': ' + byFile[f].length + ' times');
          }
        }
      }

      lines.push('');
    }

    // vars with arrow functions
    const vars = sf.getVariableStatements();
    for (const vs of vars) {
      for (const dec of vs.getDeclarations()) {
        const init = dec.getInitializer && dec.getInitializer();
        if (init && ((init.getKind && init.getKind() === SyntaxKind.ArrowFunction) || (init.getKind && init.getKind() === SyntaxKind.FunctionExpression))) {
          const name = dec.getName();
          const params = init.getParameters ? init.getParameters().map((p) => p.getName() + ': ' + truncate(p.getType().getText(), CONFIG.maxTypeTextLength)) : [];
          const ret = init.getReturnType ? truncate(init.getReturnType().getText(), CONFIG.maxTypeTextLength) : '(unknown)';
          const jsdoc = getJSDocSummary(dec) || getJSDocSummary(init) || '';

          lines.push('### const `' + name + ' = (' + params.join(', ') + ') => ' + ret + '`');
          if (jsdoc && jsdoc.trim()) lines.push('- **JSDoc:** ' + jsdoc);
          lines.push('- **Inputs:**');
          if (params.length === 0) lines.push('  - (none)');
          else params.forEach((p) => lines.push('  - `' + p + '`'));
          lines.push('- **Output:** `' + ret + '`');

          if (CONFIG.includeReferences) {
            const sym = dec.getSymbol && dec.getSymbol();
            const refs = sym ? findReferencesAcrossProject(sym, project, sf.getFilePath()) : [];
            if (refs.length > 0) {
              lines.push('- **Referenced in:**');
              const byFile = {};
              for (const r of refs) {
                (byFile[r.file] = byFile[r.file] || []).push(r);
              }
              for (const f of Object.keys(byFile)) {
                lines.push('  - ' + path.relative(CONFIG.rootDir, f) + ': ' + byFile[f].length + ' times');
              }
            }
          }

          lines.push('');
        }
      }
    }

    // classes
    const classes = sf.getClasses();
    for (const cls of classes) {
      const name = cls.getName() || '<anonymous>';
      const jsdoc = getJSDocSummary(cls) || '';
      lines.push('### class `' + name + '`');
      if (jsdoc && jsdoc.trim()) lines.push('- **JSDoc:** ' + jsdoc);
      lines.push('- **Members:**');
      for (const m of cls.getMethods()) {
        const sig = m.getName() + '(' + m.getParameters().map((p) => p.getName() + ': ' + truncate(p.getType().getText(), CONFIG.maxTypeTextLength)).join(', ') + ') => ' + truncate(m.getReturnType().getText(), CONFIG.maxTypeTextLength);
        lines.push('  - `' + sig + '`');
      }
      lines.push('');
    }

    // interfaces
    const interfaces = sf.getInterfaces();
    for (const itf of interfaces) {
      const name = itf.getName();
      lines.push('### interface `' + name + '`');
      lines.push('- **Members:**');
      for (const p of itf.getProperties()) {
        lines.push('  - `' + p.getName() + ': ' + truncate(p.getType().getText(), CONFIG.maxTypeTextLength) + '`');
      }
      lines.push('');
    }

    // type aliases
    const typeAliases = sf.getTypeAliases();
    for (const ta of typeAliases) {
      lines.push('### type `' + ta.getName() + ' = ' + truncate(ta.getTypeNode() && ta.getTypeNode().getText ? ta.getTypeNode().getText() : ta.getType().getText(), CONFIG.maxTypeTextLength) + '`');
      lines.push('');
    }

    // enums
    const enums = sf.getEnums();
    for (const en of enums) {
      lines.push('### enum `' + en.getName() + '`');
      lines.push('- **Members:** ' + en.getMembers().map((m) => m.getName()).join(', '));
      lines.push('');
    }

    lines.push('---\n');
  }

  // Write grouped files and a top-level index
  const outBase = path.dirname(CONFIG.outFile);
  const outDir = path.join(outBase, 'structure');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const indexLines = ['# Code Structure (index)\n'];
  indexLines.push('Generated groups:\n');

  for (const [groupKey, gLines] of groupMap.entries()) {
    const filePath = path.join(outDir, groupKey + '.md');
    fs.writeFileSync(filePath, gLines.join('\n'), { encoding: 'utf-8' });
    indexLines.push('- ' + groupKey + ': ' + path.relative(process.cwd(), filePath));
  }

  fs.writeFileSync(CONFIG.outFile, indexLines.join('\n'), { encoding: 'utf-8' });
  console.log('Docs generated: group files in ' + outDir + ' and index at ' + CONFIG.outFile);
}

run().catch((e) => {
  console.error('Error while generating docs:', e);
  process.exit(1);
});
