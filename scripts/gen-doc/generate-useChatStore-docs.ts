/**
 * Generate structured markdown docs for `useChatStore` using ts-morph (TypeScript).
 * Usage:
 *   npx ts-node scripts/gen-doc/generate-useChatStore-docs.ts
 * Outputs: docs/useChatStore/*.md
 */

import { Project, SyntaxKind, Node } from 'ts-morph';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'docs', 'useChatStore');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const project = new Project({ tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json') });
project.addSourceFilesAtPaths(['app/**/*.{ts,tsx,js,jsx}', 'client/**/*.{ts,tsx,js,jsx}', 'components/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}', 'api/**/*.{ts,tsx,js,jsx}']);

function truncate(s: string | undefined, n = 600) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function getJSDocSummary(node: Node) {
  try {
    const docs = (node as any).getJsDocs ? (node as any).getJsDocs() : [];
    if (!docs || docs.length === 0) return '';
    return docs.map((d: any) => (d.getComment ? d.getComment() : '') || '').join(' ').trim();
  } catch (e) {
    return '';
  }
}

function writeFile(name: string, content: string) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, content, { encoding: 'utf-8' });
  console.log('Wrote', path.relative(process.cwd(), p));
}

function findSymbolByName(name: string) {
  for (const sf of project.getSourceFiles()) {
    const varDec = (sf as any).getVariableDeclaration && (sf as any).getVariableDeclaration(name);
    if (varDec) return { varDec, sf };
    const exports = sf.getExportSymbols ? sf.getExportSymbols().filter((s: any) => s.getName() === name) : [];
    if (exports.length) return { symbol: exports[0], sf };
  }
  return null;
}

function collectExternalCalls(node: Node) {
  const calls: string[] = [];
  const identifiers = ['getClientApi', 'ChatControllerPool', 'indexedDBStorage', 'showToast', 'executeMcpAction', 'getAllTools', 'getClientApi', 'useUpdateStore', 'getMessageTextContent'];
  node.forEachDescendant((n: any) => {
    if (n.getKind() === SyntaxKind.PropertyAccessExpression || n.getKind() === SyntaxKind.Identifier) {
      const txt = n.getText();
      for (const id of identifiers) {
        if (txt.includes(id) && !calls.includes(id)) calls.push(id);
      }
    }
    if (n.getKind() === SyntaxKind.CallExpression) {
      const ce = n as any;
      const expr = ce.getExpression().getText ? ce.getExpression().getText() : '';
      // detect llm.chat calls
      if (expr.includes('.llm.chat') || expr.endsWith('.chat')) {
        if (!calls.includes('llm.chat')) calls.push('llm.chat');
      }
    }
  });
  return calls;
}

async function run() {
  const found = findSymbolByName('useChatStore');
  if (!found) {
    console.error('useChatStore not found in project');
    process.exit(1);
  }

  const sf = found.sf as any;
  const originPath = sf.getFilePath();
  const varDec = found.varDec || (found.symbol && found.symbol.getDeclarations && found.symbol.getDeclarations()[0]);
  if (!varDec) {
    console.error('failed to resolve variable declaration for useChatStore');
    process.exit(1);
  }

  const init = varDec.getInitializer ? varDec.getInitializer() : null;
  let methods: { name: string; node: Node; text: string; jsdoc: string }[] = [];
  try {
    const arrowOrFunc = init && init.getArguments ? init.getArguments()[1] : null;
    const body = arrowOrFunc && arrowOrFunc.getBody ? arrowOrFunc.getBody() : null;
    if (body) {
      const methodsVar = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((d: any) => d.getName && d.getName() === 'methods');
      if (methodsVar) {
        const objLit = methodsVar.getInitializer();
        if (objLit && (objLit as any).getProperties) {
          const props = (objLit as any).getProperties();
          methods = props.map((p: any) => ({ name: p.getName(), node: p, text: truncate(p.getText(), 2000), jsdoc: getJSDocSummary(p) }));
        }
      }
    }
  } catch (e) {
    console.warn('Failed to extract methods from initializer:', (e as any).message || e);
  }

  const overviewLines: string[] = [];
  overviewLines.push('# useChatStore — Overview');
  overviewLines.push('**Location:** ' + path.relative(process.cwd(), originPath));
  overviewLines.push('**Export:** `useChatStore` — persisted store created by `createPersistStore`.');
  overviewLines.push('');
  overviewLines.push('## Quick facts');
  overviewLines.push('- Default state keys: `sessions`, `currentSessionIndex`, `lastInput`');
  overviewLines.push('- Detected methods: ' + (methods.map((m) => '`' + m.name + '`').join(', ')));
  overviewLines.push('');
  writeFile('overview.md', overviewLines.join('\n'));

  const methodsDir = path.join(OUT_DIR, 'methods');
  if (!fs.existsSync(methodsDir)) fs.mkdirSync(methodsDir, { recursive: true });

  for (const m of methods) {
    const sanitized = m.name.replace(/[^a-zA-Z0-9_-]/g, '') || 'method';
    const lines: string[] = [];
    lines.push('# ' + m.name);
    lines.push('**Summary:** ' + (m.jsdoc || '(none)'));
    lines.push('');
    lines.push('**Declaration (trimmed):**');
    lines.push('```ts');
    lines.push(m.text);
    lines.push('```');
    lines.push('');

    // parameters & return type (attempt)
    try {
      const prop = m.node as any;
      // prop can be PropertyAssignment (with initializer function) or MethodDeclaration
      let funcNode = null;
      if (prop.getInitializer && prop.getInitializer().getKind && prop.getInitializer().getKind() === SyntaxKind.ArrowFunction) {
        funcNode = prop.getInitializer();
      } else if (prop.getKind && prop.getKind() === SyntaxKind.MethodDeclaration) {
        funcNode = prop;
      } else if (prop.getInitializer) {
        const init2 = prop.getInitializer();
        if (init2 && (init2.getKind() === SyntaxKind.FunctionExpression || init2.getKind() === SyntaxKind.ArrowFunction)) funcNode = init2;
      }

      if (funcNode) {
        const params = (funcNode as any).getParameters ? (funcNode as any).getParameters() : [];
        if (params.length) {
          lines.push('**Inputs (parameters):**');
          params.forEach((p: any) => {
            const name = p.getName();
            const type = p.getType ? truncate(p.getType().getText(), 200) : '';
            lines.push('- `' + name + '` : ' + (type || '(inferred)'));
          });
        } else {
          lines.push('**Inputs (parameters):** (none)');
        }

        // attempt return type
        const sig = (funcNode as any).getReturnType ? (funcNode as any).getReturnType() : null;
        if (sig) {
          lines.push('');
          lines.push('**Return type (inferred):** `' + truncate(sig.getText(), 200) + '`');
        }

        // collect external calls and side-effects
        const calls = collectExternalCalls(funcNode);
        lines.push('');
        lines.push('**Detected external dependencies / side-effects:**');
        if (calls.length === 0) {
          lines.push('- (none detected by heuristics)');
        } else {
          calls.forEach((c) => lines.push('- ' + c));
        }

        // detect llm.chat callbacks inside
        const chatCalls: { expr: string; callbacks: string[] }[] = [];
          funcNode.forEachDescendant((n: any) => {
          if (n.getKind() === SyntaxKind.CallExpression) {
            const ce = n as any;
            let exprTxt = '';
            try { exprTxt = ce.getExpression().getText(); } catch (e) { exprTxt = ce.getExpression().getText ? ce.getExpression().getText() : ''; }
            if (exprTxt.includes('.llm.chat') || exprTxt.endsWith('.chat')) {
              const cbNames: string[] = [];
              const arg = ce.getArguments && ce.getArguments()[0];
              if (arg) {
                const props = arg.getProperties ? arg.getProperties() : [];
                props.forEach((p: any) => {
                  const nname = p.getName && p.getName();
                  if (['onUpdate', 'onFinish', 'onError', 'onBeforeTool', 'onAfterTool', 'onController', 'onBefore', 'onAfter'].includes(nname)) cbNames.push(nname);
                });
              }
              chatCalls.push({ expr: exprTxt, callbacks: cbNames });
            }
          }
        });

        if (chatCalls.length) {
          lines.push('');
          lines.push('**Detected llm.chat calls and callbacks:**');
          chatCalls.forEach((cc) => {
            lines.push('- `' + cc.expr + '` — callbacks: ' + (cc.callbacks.length ? cc.callbacks.join(', ') : '(none detected)'));
          });
        }
      }
    } catch (e) {
      lines.push('(failed to analyze parameters/return for this method)');
    }

    // find references across project (simple text search for method name on identifiers)
    try {
      const propRefs: { file: string; line: number; context: string }[] = [];
      for (const sf2 of project.getSourceFiles()) {
        if (sf2.getFilePath() === originPath) continue;
        const ids = sf2.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const id of ids) {
          if (id.getText() !== m.name) continue;
          const parent = id.getParent();
          const txt = parent.getText ? truncate(parent.getText(), 300) : id.getText();
          propRefs.push({ file: sf2.getFilePath(), line: id.getStartLineNumber(), context: txt.replace(/\n/g, ' ') });
        }
      }
      if (propRefs.length) {
        lines.push('');
        lines.push('**Referenced in:**');
        const grouped: Record<string, any[]> = {};
        propRefs.forEach((r) => (grouped[r.file] = grouped[r.file] || []).push(r));
        for (const f of Object.keys(grouped)) {
          lines.push('- `' + path.relative(process.cwd(), f) + '` — ' + grouped[f].length + ' occurrence(s)');
          for (const occ of grouped[f].slice(0, 6)) {
            lines.push('  - line ' + occ.line + ': `' + occ.context + '`');
          }
        }
      }
    } catch (e) {
      // ignore
    }

    writeFile(path.join('methods', sanitized + '.md'), lines.join('\n'));
  }

  // types & state
  const typesLines: string[] = ['# useChatStore — Types & State Shape', ''];
  try {
    const constDecl = (sf as any).getVariableDeclaration && (sf as any).getVariableDeclaration('DEFAULT_CHAT_STATE');
    if (constDecl) {
      const init = constDecl.getInitializer && constDecl.getInitializer();
      if (init) {
        typesLines.push('**DEFAULT_CHAT_STATE (trimmed):**');
        typesLines.push('```ts');
        typesLines.push(truncate(init.getText(), 800));
        typesLines.push('```');
      }
    }

    const itf = (sf as any).getInterface && (sf as any).getInterface('ChatSession');
    if (itf) {
      typesLines.push('');
      typesLines.push('**Interface `ChatSession`**');
      (itf as any).getProperties().forEach((p: any) => typesLines.push('- `' + p.getName() + ': ' + truncate(p.getType().getText(), 200) + '`'));
    }

    const msgItf = (sf as any).getTypeAlias && (sf as any).getTypeAlias('ChatMessage');
    if (msgItf) {
      typesLines.push('');
      typesLines.push('**Type `ChatMessage` (alias)**');
      typesLines.push('```ts');
      typesLines.push(truncate((msgItf as any).getTypeNode().getText(), 800));
      typesLines.push('```');
    }
  } catch (e) {
    typesLines.push('(failed to collect all types: ' + (e as any).message + ')');
  }

  writeFile('types.md', typesLines.join('\n'));

  // index
  const indexLines = ['# useChatStore documentation', '', '- Overview: `overview.md`', "- Types & State: `types.md`", '- Methods: `methods/` (one file per method)', '', 'Generated by scripts/gen-doc/generate-useChatStore-docs.ts'];
  writeFile('index.md', indexLines.join('\n'));

  console.log('Done.');
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
