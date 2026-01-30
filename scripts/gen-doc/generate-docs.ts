import { Project, SyntaxKind, ts } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

/*
  generate-docs.ts

  用途：
  - 使用 ts-morph 遍歷專案源碼，找出與 openai / openaiimage / auth 相關的檔案與符號
  - 為每個相關檔案產生一個簡潔的 Markdown 檔案，包含：輸入/輸出、導出符號、JSDoc、引用位置（來源於其他檔案）

  使用方式：
    yarn generate:docs

  備註：設計以簡潔清晰為主，產出會放在 `docs/generated/` 下
*/

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const outDir = path.resolve(process.cwd(), "docs", "generated");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function short(text: string, max = 400) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n...";
}

function formatSignature(node: any, checker: any) {
  try {
    if (node.getKindName && node.getKindName() === "FunctionDeclaration") {
      const sig = checker.getSignatureFromDeclaration(node.compilerNode as any);
      if (!sig) return node.getText().split("{", 1)[0].trim();
      return checker.signatureToString(sig as any);
    }
    return node.getText().split("{", 1)[0].trim();
  } catch (e) {
    return node.getText().split("{", 1)[0].trim();
  }
}

function getJSDocText(node: any) {
  try {
    const docs = node.getJsDocs();
    if (!docs || docs.length === 0) return "";
    return docs.map((d: any) => d.getComment()).filter(Boolean).join("\n");
  } catch (e) {
    return "";
  }
}

// Heuristics to find "related" files
const relatedKeywords = ["openai", "openaiimage", "auth", "api/openai", "api/openaiimage"];

const sourceFiles = project.getSourceFiles();

// Find candidate files by path or by import specifier
const candidates = new Map<string, import("ts-morph").SourceFile>();

for (const sf of sourceFiles) {
  const p = sf.getFilePath().toLowerCase();
  for (const k of relatedKeywords) {
    if (p.includes(k)) {
      candidates.set(sf.getFilePath(), sf);
      break;
    }
  }

  // also if it imports modules that mention keywords
  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue().toLowerCase();
    for (const k of relatedKeywords) {
      if (spec.includes(k)) {
        candidates.set(sf.getFilePath(), sf);
        break;
      }
    }
  }
}

// Expand candidates by finding references to exported symbols in other files (to capture UI that uses the APIs)
const expanded = new Map(candidates);
for (const sf of Array.from(candidates.values())) {
  try {
    const exports = sf.getExportedDeclarations();
    for (const [name, decls] of exports) {
      for (const d of decls) {
        const refs = (d as any).findReferences ? (d as any).findReferences() : [];
        for (const r of refs) {
          for (const ref of r.getReferences()) {
            const refSource = ref.getSourceFile();
            if (refSource && !expanded.has(refSource.getFilePath())) {
              expanded.set(refSource.getFilePath(), refSource);
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

const checker = project.getTypeChecker();

const tocEntries: { title: string; file: string }[] = [];

for (const [filePath, sf] of expanded) {
  const rel = path.relative(process.cwd(), filePath);
  const outFile = path.join(outDir, rel.replace(/\/(src\/)?/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "_") + ".md");
  const dir = path.dirname(outFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const header = `# ${path.basename(filePath)}\n\n`;
  const shortPath = `**Path:** \`${rel}\`\n\n`;
  const description = short(getJSDocText(sf) || sf.getStatements().slice(0, 6).map(s => s.getText()).join("\n"), 800) + "\n\n";

  const exports = sf.getExportedDeclarations();
  let exportSection = "";
  if (exports.size === 0) {
    exportSection = "No exported declarations found.\n\n";
  } else {
    exportSection = "## Exports\n\n";
    for (const [name, decls] of exports) {
      for (const d of decls) {
        const kind = (d as any).getKindName ? (d as any).getKindName() : ((d as any).getSymbol ? (d as any).getSymbol().getName() : "Declaration");
        const sig = formatSignature(d, checker as any);
        const jsdoc = getJSDocText(d) || "";

        // find references
        let refList = [] as string[];
        try {
          const refs = (d as any).findReferences ? (d as any).findReferences() : [];
          for (const r of refs) {
            for (const ref of r.getReferences()) {
              const refSource = ref.getSourceFile();
              if (!refSource) continue;
              const rp = path.relative(process.cwd(), refSource.getFilePath());
              const snippet = short(ref.getNode().getText(), 200).replace(/`/g, "\\`");
              refList.push(`- \`${rp}\`: \`${snippet}\``);
            }
          }
        } catch (e) {
          // ignore
        }

        exportSection += `### ${name}  \n\n`;
        exportSection += `- **Kind:** ${kind}  \n`;
        exportSection += `- **Signature:** \n\n\`\`\`ts\n${sig}\n\`\`\`\n\n`;
        if (jsdoc) exportSection += `- **Docs:** ${jsdoc}  \n\n`;

        // If function-like, extract inputs/outputs
        try {
          const kindName = (d as any).getKindName ? (d as any).getKindName() : "";
          const fnLike = kindName && /Function|Method|ArrowFunction/.test(kindName);
          const declNode = (d as any).getDeclarations ? ((d as any).getDeclarations()[0]) : (d as any);
          if (fnLike && declNode) {
            const params = (declNode.getParameters ? declNode.getParameters() : []) as any[];
            if (params.length) {
              exportSection += `- **Inputs:**\n\n`;
              for (const p of params) {
                try {
                  const pName = p.getName();
                  const pType = p.getType ? p.getType().getText() : "any";
                  exportSection += `  - \`${pName}\`: \`${pType}\`\n`;
                } catch (e) {}
              }
              exportSection += `\n`;
            }

            try {
              const retType = (declNode.getReturnType ? declNode.getReturnType().getText() : undefined) || ((declNode.getType && declNode.getType().getText && declNode.getType().getText()) ? declNode.getType().getText() : undefined);
              if (retType) {
                exportSection += `- **Outputs:** \n\n  - \`${retType}\`\n\n`;
              }
            } catch (e) {}
          }
        } catch (e) {}

        if (refList.length) {
          exportSection += `- **Referenced in:**\n\n${refList.join("\n")}\n\n`;
        }
      }
    }
  }

  // Files that import this file (simple approach: check other source files' imports)
  const importedBy: string[] = [];
  for (const other of sourceFiles) {
    if (other === sf) continue;
    for (const imp of other.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      try {
        const resolved = imp.getModuleSpecifierSourceFile();
        if (resolved && resolved.getFilePath() === sf.getFilePath()) {
          importedBy.push(path.relative(process.cwd(), other.getFilePath()));
        }
      } catch (e) {}
      if (!importedBy.length) {
        const specLower = spec && spec.toLowerCase();
        if (specLower && specLower.includes(path.basename(filePath).toLowerCase())) {
          importedBy.push(path.relative(process.cwd(), other.getFilePath()));
        }
      }
    }
  }

  let importsSection = "";
  if (importedBy.length) {
    importsSection = "## Imported By\n\n" + importedBy.map(p => `- \`${p}\``).join("\n") + "\n\n";
  }

  // brief code overview (first ~200 chars)
  const codePreview = "## Code Preview\n\n```ts\n" + short(sf.getText(), 800) + "\n```\n\n";

  const content = header + shortPath + description + exportSection + importsSection + codePreview;
  fs.writeFileSync(outFile, content, "utf-8");

  tocEntries.push({ title: path.basename(filePath), file: path.relative(outDir, outFile) });
}

// write TOC
  const indexMd = `# Generated API & UI docs\n\nThis folder is automatically generated by \`scripts/generate-docs.ts\`.\n\n## Contents\n\n${tocEntries
  .map((e) => `- [${e.title}](./${e.file.replace(/\\\\/g, "/")})`)
  .join("\n")}\n`;
fs.writeFileSync(path.join(outDir, "README.md"), indexMd, "utf-8");

console.log("Docs generated to:", outDir);
