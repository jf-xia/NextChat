#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { Project, SyntaxKind } = require('ts-morph');

function shortPath(fp) {
  return path.relative(process.cwd(), fp);
}

function classifyFile(fp) {
  const p = fp.replaceAll('\\', '/');
  const frontend = /(^|\/)app\b|(^|\/)client\b|(^|\/)components\b|(^|\/)pages\b|(^|\/)ui\b/i;
  const backend = /(^|\/)api\b|(^|\/)server\b|(^|\/)lib\b|(^|\/)prisma\b|(^|\/)routes?\b|(^|\/)services?\b/i;
  if (backend.test(p) && !frontend.test(p)) return 'backend';
  if (frontend.test(p) && !backend.test(p)) return 'frontend';
  // fallback by heuristic
  if (/node_modules|\.test\./i.test(p)) return 'other';
  // prefer backend for files under top-level API folders
  return 'frontend';
}

function formatParams(params) {
  return params.map(p => `${p.getName()}: ${p.getType().getText()}`).join(', ');
}

function methodToSummary(m) {
  try {
    const name = m.getName();
    const params = m.getParameters ? formatParams(m.getParameters()) : '';
    const ret = m.getReturnType ? m.getReturnType().getText() : (m.getType ? m.getType().getText() : 'unknown');
    return `- **${name}**(${params}) → ${ret}`;
  } catch (e) {
    return `- **${m.getName()}** — (unable to resolve signature)`;
  }
}

(async function main() {
  console.log('🔎 Starting LLMApi analysis with ts-morph...');

  const project = new Project({ tsConfigFilePath: path.resolve(__dirname, '../tsconfig.json'), skipAddingFilesFromTsConfig: false });
  // limit file globs to project source folders to avoid high memory usage
  project.addSourceFilesAtPaths([
    'app/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
    'config/**/*.{ts,tsx,js,jsx}',
    'components/**/*.{ts,tsx,js,jsx}',
    'app/client/platforms/**/*.{ts,tsx,js,jsx}',
    '.github/**/*.{md,ts,js}',
  ]);
  const sourceFiles = project.getSourceFiles();

  // find LLMApi declaration (class or interface)
  let llmDecl = null;
  for (const sf of sourceFiles) {
    const classes = sf.getClasses();
    for (const c of classes) {
      if (c.getName() === 'LLMApi') {
        llmDecl = c;
        break;
      }
    }
    if (llmDecl) break;
    const interfaces = sf.getInterfaces();
    for (const i of interfaces) {
      if (i.getName() === 'LLMApi') {
        llmDecl = i;
        break;
      }
    }
    if (llmDecl) break;
  }

  if (!llmDecl) {
    console.error('❌ Could not find `LLMApi` declaration in project.');
    process.exit(1);
  }

  const llmFile = llmDecl.getSourceFile().getFilePath();
  console.log(`✅ Found LLMApi declaration in ${shortPath(llmFile)}`);

  // gather structure (methods and their signatures)
  let members = [];
  try {
    if (llmDecl.getMethods) {
      members = llmDecl.getMethods();
    } else if (llmDecl.getMembers) {
      members = llmDecl.getMembers().filter(m => m.getKind && [SyntaxKind.MethodSignature, SyntaxKind.MethodDeclaration].includes(m.getKind()));
    }
  } catch (e) {
    // ignore
  }

  const methodSummaries = members.map(methodToSummary);

  // find referencing nodes in other source files
  let refs = [];
  try {
    refs = llmDecl.getReferencingNodesInOtherSourceFiles ? llmDecl.getReferencingNodesInOtherSourceFiles() : [];
  } catch (e) {
    console.warn('⚠️ getReferencingNodesInOtherSourceFiles not available. Falling back to global text search.');
    // fallback: naive search for 'LLMApi' usage
    for (const sf of sourceFiles) {
      if (sf === llmDecl.getSourceFile()) continue;
      if (sf.getFullText().includes('LLMApi')) {
        refs.push(sf.getFirstDescendantByKind(SyntaxKind.Identifier));
      }
    }
  }


  // Scan ASTs directly to find implementations and typed references to LLMApi
  const implementations = [];
  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();

    // classes that implement LLMApi
    for (const cls of sf.getClasses()) {
      const impls = cls.getImplements().map(i => i.getText()).join(',');
      if (impls.includes('LLMApi')) {
        const name = cls.getName() || '<anonymous>';
        const implMethods = cls.getMethods ? cls.getMethods().map(m => methodToSummary(m)).filter(Boolean) : [];
        const exported = cls.isExported && cls.isExported();
        implementations.push({ name, filePath, exported, kind: 'class', methods: implMethods });
      }
    }

    // variables typed as LLMApi (object literal implementations)
    for (const varDecl of sf.getVariableDeclarations()) {
      const typeNode = varDecl.getTypeNode();
      if (typeNode && typeNode.getText && typeNode.getText().includes('LLMApi')) {
        const name = varDecl.getName();
        const initializer = varDecl.getInitializer && varDecl.getInitializer();
        let implMethods = [];
        if (initializer && initializer.getKind && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
          implMethods = initializer.getProperties ? initializer.getProperties().map(p => `- ${p.getName ? p.getName() : p.getText()}`) : [];
        }
        implementations.push({ name, filePath, exported: varDecl.isExported && varDecl.isExported(), kind: 'variable', type: typeNode.getText(), methods: implMethods });
      }
    }

    // functions with parameters typed as LLMApi
    for (const fun of sf.getFunctions()) {
      for (const p of fun.getParameters()) {
        const tnode = p.getTypeNode();
        if (tnode && tnode.getText && tnode.getText().includes('LLMApi')) {
          implementations.push({ name: fun.getName() || '<anonymous_fn_param>', filePath, exported: fun.isExported && fun.isExported(), kind: 'function-param', methods: [] });
        }
      }
    }
  }

  // deduplicate implementations by file+name
  const uniqueKey = x => `${x.filePath}::${x.name}`;
  const seen = new Set();
  const uniqueImpls = implementations.filter(i => {
    const k = uniqueKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const byCategory = { frontend: [], backend: [], other: [] };
  for (const impl of uniqueImpls) {
    const cat = classifyFile(impl.filePath);
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(impl);
  }

  // produce concise markdown
  function produceMd(category, items) {
    const lines = [];
    lines.push(`# LLMApi — ${category === 'frontend' ? 'Frontend Implementations' : category === 'backend' ? 'Backend Implementations' : 'Other Implementations'}`);
    lines.push('');
    lines.push('> Automatically generated. Summary is intentionally concise — lists where LLMApi is implemented or referenced and key method signatures.');
    lines.push('');
    lines.push('## LLMApi core structure');
    lines.push('');
    lines.push('- Declared in:');
    lines.push(`  - \`${shortPath(llmFile)}\``);
    lines.push('');
    lines.push('### Methods');
    lines.push('');
    if (methodSummaries.length) lines.push(...methodSummaries); else lines.push('- (no methods discovered)');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Implementations & References');
    lines.push('');

    if (!items.length) {
      lines.push('No implementations or references discovered for this category.');
      return lines.join('\n');
    }

    for (const it of items) {
      lines.push(`### ${it.name} — \`${shortPath(it.filePath)}\``);
      lines.push('');
      lines.push(`- **Kind**: ${it.kind}`);
      if (typeof it.type !== 'undefined') lines.push(`- **Type annotation**: \`${it.type}\``);
      lines.push(`- **Exported**: ${it.exported ? 'yes' : 'no'}`);
      if (it.methods && it.methods.length) {
        lines.push('- **Implementing methods**:');
        lines.push('');
        lines.push(...it.methods.slice(0, 20));
      } else {
        lines.push('- **Implementing methods**: (none detected or implemented indirectly)');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // usage notes
    lines.push('## Usage notes');
    lines.push('');
    lines.push('- Look for `chat`, `speech`, `usage`, `models` methods as primary LLM surface.');
    lines.push('- For deeper I/O flow, inspect files listed above — they show how the LLMApi is instantiated and invoked.');

    return lines.join('\n');
  }

  // write files
  const outDir = path.resolve(__dirname, '..', 'docs', 'llmapi');
  fs.mkdirSync(outDir, { recursive: true });

  const frontendMd = produceMd('frontend', byCategory.frontend || []);
  const backendMd = produceMd('backend', byCategory.backend || []);
  const otherMd = produceMd('other', byCategory.other || []);

  fs.writeFileSync(path.join(outDir, 'frontend.md'), frontendMd);
  fs.writeFileSync(path.join(outDir, 'backend.md'), backendMd);
  fs.writeFileSync(path.join(outDir, 'other.md'), otherMd);

  console.log('✅ Documentation generated:');
  console.log(' -', path.relative(process.cwd(), path.join(outDir, 'frontend.md')));
  console.log(' -', path.relative(process.cwd(), path.join(outDir, 'backend.md')));
  console.log(' -', path.relative(process.cwd(), path.join(outDir, 'other.md')));
  console.log('\n🔧 Tip: Install `ts-morph` if not present: `npm i -D ts-morph`');
})();
