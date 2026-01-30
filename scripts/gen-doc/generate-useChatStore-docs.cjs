/*
Generate concise markdown docs for `useChatStore` using ts-morph.
Usage: node scripts/generate-useChatStore-docs.cjs
Outputs: docs/useChatStore/*.md
*/

const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'docs', 'useChatStore');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const project = new Project({ tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json') });
project.addSourceFilesAtPaths(['app/**/*.{ts,tsx,js,jsx}', 'client/**/*.{ts,tsx,js,jsx}', 'components/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,tsx,js,jsx}']);

function truncate(s, n = 240) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function getJSDocSummary(node) {
  try {
    const docs = node.getJsDocs ? node.getJsDocs() : [];
    if (!docs || docs.length === 0) return '';
    return docs.map((d) => (d.getComment ? d.getComment() : '') || '').join(' ').trim();
  } catch (e) {
    return '';
  }
}

// Find symbol declarations across project by name
function findSymbolByName(name) {
  for (const sf of project.getSourceFiles()) {
    const varDec = sf.getVariableDeclaration && sf.getVariableDeclaration(name);
    if (varDec) return { varDec, sf };
    const exports = sf.getExportSymbols ? sf.getExportSymbols().filter((s) => s.getName() === name) : [];
    if (exports.length) return { symbol: exports[0], sf };
  }
  return null;
}

function findReferencesAcrossProject(symbolDecls, originFilePath) {
  const refs = [];
  for (const sf of project.getSourceFiles()) {
    const sfPath = sf.getFilePath();
    if (path.resolve(sfPath) === path.resolve(originFilePath)) continue;
    const ids = sf.getDescendantsOfKind(SyntaxKind.Identifier);
    for (const id of ids) {
      try {
        const idSym = id.getSymbol && id.getSymbol();
        if (!idSym) continue;
        const idDecls = idSym.getDeclarations();
        if (idDecls.some((d) => symbolDecls.includes(d))) {
          refs.push({ file: sf.getFilePath(), line: id.getStartLineNumber(), col: id.getStartColumn(), text: truncate(id.getParent().getText(), 200) });
        }
      } catch (e) {
        // ignore
      }
    }
  }
  return refs;
}

function writeFile(name, content) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, content, { encoding: 'utf-8' });
  console.log('Wrote', path.relative(process.cwd(), p));
}

async function run() {
  const found = findSymbolByName('useChatStore');
  if (!found) {
    console.error('useChatStore not found in project');
    process.exit(1);
  }

  const sf = found.sf;
  const originPath = sf.getFilePath();

  // Locate variable declaration
  const varDec = found.varDec || (found.symbol && found.symbol.getDeclarations && found.symbol.getDeclarations()[0]);
  if (!varDec) {
    console.error('failed to resolve variable declaration for useChatStore');
    process.exit(1);
  }

  // extract initializer (call to createPersistStore)
  const init = varDec.getInitializer ? varDec.getInitializer() : null;

  // extract methods by finding `methods` variable inside initializer function
  let methods = [];
  try {
    // the initializer is a call expression createPersistStore(DEFAULT_CHAT_STATE, (set,_get) => { ... })
    const arrowOrFunc = init.getArguments ? init.getArguments()[1] : null;
    const body = arrowOrFunc && arrowOrFunc.getBody ? arrowOrFunc.getBody() : null;
    if (body) {
      const methodsVar = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((d) => d.getName && d.getName() === 'methods');
      if (methodsVar) {
        const objLit = methodsVar.getInitializer();
        if (objLit && objLit.getProperties) {
          methods = objLit.getProperties().map((p) => ({ name: p.getName(), text: truncate(p.getText(), 800), jsdoc: getJSDocSummary(p) }));
        }
      }
    }
  } catch (e) {
    console.warn('Failed to extract methods from initializer:', e.message || e);
  }

  // Basic overview
  const overviewLines = [];
  overviewLines.push('# useChatStore — Overview');
  overviewLines.push('**Location:** `' + path.relative(process.cwd(), originPath) + '`');
  overviewLines.push('**Symbol:** `useChatStore` — persisted Zustand-like store created by `createPersistStore`.');
  overviewLines.push('');

  overviewLines.push('## Quick facts');
  overviewLines.push('- Export: `export const useChatStore`');
  overviewLines.push('- Default state keys: `sessions`, `currentSessionIndex`, `lastInput`');
  overviewLines.push('- Methods: ' + (methods.map((m) => m.name).join(', ')));
  overviewLines.push('');

  overviewLines.push('## Sample method list (concise)');
  methods.forEach((m) => {
    overviewLines.push('- `' + m.name + '` — ' + (m.jsdoc || m.text.split('\n')[0] || '').replace(/\s+/g, ' ').trim());
  });

  writeFile('overview.md', overviewLines.join('\n'));

  // Methods docs
  const methodsDir = path.join(OUT_DIR, 'methods');
  if (!fs.existsSync(methodsDir)) fs.mkdirSync(methodsDir, { recursive: true });

  for (const m of methods) {
    const name = m.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const lines = [];
    lines.push('# ' + m.name);
    lines.push('**Declaration (trimmed):**');
    lines.push('```ts');
    lines.push(m.text);
    lines.push('```');
    lines.push('');
    lines.push('**JSDoc / Summary:** ' + (m.jsdoc || '(none)'));

    // find references to this method across project: find identifier with this name whose declarations are from the property
    // get the property declaration node
    try {
      // iterate all files and find identifiers referring to property of useChatStore
      const propRefs = [];
      for (const sf2 of project.getSourceFiles()) {
        const ids = sf2.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const id of ids) {
          try {
            if (id.getText() !== m.name) continue;
            const parent = id.getParent();
            // look for patterns like useChatStore.getState().<method> or useChatStore().<method> or useChatStore.<method>
            const txt = parent.getText ? parent.getText() : id.getText();
            if (txt.includes(m.name) && sf2.getFilePath() !== originPath) {
              propRefs.push({ file: sf2.getFilePath(), line: id.getStartLineNumber(), context: truncate(parent.getText(), 180) });
            }
          } catch (e) {}
        }
      }

      if (propRefs.length > 0) {
        lines.push('');
        lines.push('**Referenced in:**');
        const grouped = {};
        propRefs.forEach((r) => (grouped[r.file] = grouped[r.file] || []).push(r));
        for (const f of Object.keys(grouped)) {
          lines.push('- `' + path.relative(process.cwd(), f) + '` — ' + grouped[f].length + ' occurrence(s)');
          for (const occ of grouped[f].slice(0, 6)) {
            lines.push('  - line ' + occ.line + ': `' + occ.context.replace(/\n/g, ' ') + '`');
          }
        }
      }

      writeFile(path.join('methods', name + '.md'), lines.join('\n'));
    } catch (e) {
      console.warn('failed to analyze method', m.name, e.message || e);
    }
  }

  // References to the top-level symbol
  const symDecls = (varDec.getSymbol && varDec.getSymbol().getDeclarations()) || [varDec];
  const refs = findReferencesAcrossProject(symDecls, originPath);
  const refLines = ['# useChatStore — References', ''];
  if (refs.length === 0) {
    refLines.push('(no external references found)');
  } else {
    const byFile = {};
    refs.forEach((r) => (byFile[r.file] = byFile[r.file] || []).push(r));
    for (const f of Object.keys(byFile)) {
      refLines.push('## `' + path.relative(process.cwd(), f) + '` — ' + byFile[f].length + ' occurrence(s)');
      for (const occ of byFile[f].slice(0, 50)) {
        refLines.push('- line ' + occ.line + ': `' + occ.text.replace(/\n/g, ' ') + '`');
      }
    }
  }

  writeFile('references.md', refLines.join('\n'));

  // Types & state shape: try to find DEFAULT_CHAT_STATE and ChatSession/ChatMessage types
  const typesLines = ['# useChatStore — Types & State Shape', ''];
  try {
    // DEFAULT_CHAT_STATE value
    const constDecl = sf.getVariableDeclaration && sf.getVariableDeclaration('DEFAULT_CHAT_STATE');
    if (constDecl) {
      const init = constDecl.getInitializer && constDecl.getInitializer();
      if (init) {
        typesLines.push('**DEFAULT_CHAT_STATE (trimmed):**');
        typesLines.push('```ts');
        typesLines.push(truncate(init.getText(), 800));
        typesLines.push('```');
      }
    }

    // ChatSession interface
    const itf = sf.getInterface && sf.getInterface('ChatSession');
    if (itf) {
      typesLines.push('');
      typesLines.push('**Interface `ChatSession`**');
      itf.getProperties().forEach((p) => typesLines.push('- `' + p.getName() + ': ' + truncate(p.getType().getText(), 200) + '`'));
    }

    const msgItf = sf.getTypeAlias && sf.getTypeAlias('ChatMessage');
    if (msgItf) {
      typesLines.push('');
      typesLines.push('**Type `ChatMessage` (alias)**');
      typesLines.push('```ts');
      typesLines.push(truncate(msgItf.getTypeNode().getText(), 800));
      typesLines.push('```');
    }
  } catch (e) {
    typesLines.push('(failed to collect all types: ' + e.message + ')');
  }

  writeFile('types.md', typesLines.join('\n'));

  // index file
  const indexLines = ['# useChatStore documentation', '', '- Overview: `overview.md`', "- Types & State: `types.md`", "- References: `references.md`", "- Methods: `methods/` (one file per method)", '', 'Generated by scripts/generate-useChatStore-docs.cjs'];
  writeFile('index.md', indexLines.join('\n'));

  console.log('Done.');
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
