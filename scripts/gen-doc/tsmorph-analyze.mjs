#!/usr/bin/env node
import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

function relative(p) {
  return path.relative(process.cwd(), p).replaceAll('\\\\', '/');
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipFileDependencyResolution: true,
  });

  const sourceFiles = project.getSourceFiles().filter((f) => {
    const fp = f.getFilePath();
    if (fp.includes("/node_modules/")) return false;
    if (fp.includes("/.next/")) return false;
    if (fp.endsWith('.d.ts')) return false;
    return true;
  });

  const results = [];

  for (const sf of sourceFiles) {
    const filePath = relative(sf.getFilePath());
    const fileInfo = {
      filePath,
      functions: [],
      classes: [],
      exports: sf.getExportSymbols().map(s => s.getName()),
      imports: sf.getImportDeclarations().map(d => d.getModuleSpecifierValue()),
    };

    // free functions
    for (const fn of sf.getFunctions()) {
      const fnJsDocs = typeof fn.getJsDocs === "function" ? fn.getJsDocs().map(d => d.getComment()) : [];
      const bodyText = typeof fn.getBodyText === "function" ? fn.getBodyText() : undefined;
      fileInfo.functions.push({
        name: fn.getName() || "<anonymous>",
        isExported: fn.isExported(),
        start: fn.getStartLineNumber(),
        end: fn.getEndLineNumber(),
        params: fn.getParameters().map(p => ({ name: p.getName(), type: p.getType().getText() })),
        returnType: fn.getReturnType().getText(),
        jsDocs: fnJsDocs,
        bodyPreview: bodyText ? bodyText.slice(0, 1000) : undefined,
      });
    }

    // variable statements with function expressions / arrow functions
    for (const vs of sf.getVariableStatements()) {
      for (const decl of vs.getDeclarations()) {
        const init = decl.getInitializer();
        if (!init) continue;
        if (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression) {
          const fn = init;
          const declJsDocs = typeof decl.getJsDocs === "function" ? decl.getJsDocs().map(d => d.getComment()) : [];
          const fnBody = typeof fn.getBodyText === "function" ? fn.getBodyText() : undefined;
          fileInfo.functions.push({
            name: decl.getName() || "<anonymous>",
            isExported: vs.isExported() || decl.isExported(),
            start: decl.getStartLineNumber(),
            end: decl.getEndLineNumber(),
            params: fn.getParameters().map(p => ({ name: p.getName(), type: p.getType().getText() })),
            returnType: fn.getReturnType ? fn.getReturnType().getText() : (fn.getType ? fn.getType().getText() : "unknown"),
            jsDocs: declJsDocs,
            bodyPreview: fnBody ? fnBody.slice(0, 1000) : undefined,
          });
        }
      }
    }

    // classes and methods
    for (const cls of sf.getClasses()) {
      const clsInfo = {
        name: cls.getName() || "<anonymous>",
        isExported: cls.isExported(),
        start: cls.getStartLineNumber(),
        end: cls.getEndLineNumber(),
        methods: [],
      };
      for (const m of cls.getInstanceMethods()) {
        const mJsDocs = typeof m.getJsDocs === "function" ? m.getJsDocs().map(d => d.getComment()) : [];
        const mBody = typeof m.getBodyText === "function" ? m.getBodyText() : undefined;
        clsInfo.methods.push({
          name: m.getName(),
          isStatic: m.isStatic(),
          start: m.getStartLineNumber(),
          end: m.getEndLineNumber(),
          params: m.getParameters().map(p => ({ name: p.getName(), type: p.getType().getText() })),
          returnType: m.getReturnType().getText(),
          jsDocs: mJsDocs,
          bodyPreview: mBody ? mBody.slice(0, 1000) : undefined,
        });
      }
      fileInfo.classes.push(clsInfo);
    }

    // gather call expressions (names only, local to file)
    const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression).map(c => {
      const expr = c.getExpression();
      try {
        return expr.getText();
      } catch (e) {
        return "<unknown>";
      }
    });
    fileInfo.callExpressions = [...new Set(callExprs)];

    results.push(fileInfo);
  }

  const outDir = path.join(process.cwd(), ".analysis");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // Safe stringify to avoid circular references from ts-morph nodes
  const seen = new WeakSet();
  const payload = { generatedAt: new Date().toISOString(), results };
  const safe = JSON.stringify(payload, function (key, value) {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    if (typeof value === "function") return value.toString();
    return value;
  }, 2);
  fs.writeFileSync(path.join(outDir, "tsmorph-analysis.json"), safe);
  console.log("Analysis written to .analysis/tsmorph-analysis.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
