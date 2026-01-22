#!/bin/bash
#
# generate-tech-stack.sh
# Generates a technology stack report from the project's package.json
#
# Usage: ./generate-tech-stack.sh
#

set -e

echo "📊 AIChat Technology Stack Report"
echo "=================================="
echo "Generated: $(date)"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Run from project root."
    exit 1
fi

echo "## Core Framework"
echo "-----------------"

# Extract key dependencies
node -e "
const pkg = require('./package.json');
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const categories = {
  'Core Framework': ['next', 'react', 'react-dom'],
  'State Management': ['zustand'],
  'Styling': ['sass', 'clsx'],
  'Markdown/Content': ['react-markdown', 'rehype-highlight', 'rehype-katex', 'remark-gfm', 'remark-math', 'remark-breaks', 'mermaid'],
  'Desktop App': ['@tauri-apps/api', '@tauri-apps/cli'],
  'Database': ['@prisma/client', 'prisma'],
  'Authentication': ['@azure/msal-browser', '@azure/msal-node', '@azure/msal-react'],
  'Utilities': ['axios', 'lodash-es', 'nanoid', 'zod', 'fuse.js'],
  'Testing': ['jest', '@testing-library/react', '@testing-library/dom'],
  'Build Tools': ['typescript', 'webpack', '@svgr/webpack']
};

for (const [category, packages] of Object.entries(categories)) {
  console.log('\n### ' + category);
  for (const pkg of packages) {
    if (deps[pkg]) {
      console.log('- ' + pkg + ': ' + deps[pkg]);
    }
  }
}
"

echo ""
echo ""
echo "## Project Scripts"
echo "-----------------"
node -e "
const pkg = require('./package.json');
console.log('| Script | Command |');
console.log('|--------|---------|');
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  console.log('| ' + name + ' | \`' + cmd.substring(0, 50) + (cmd.length > 50 ? '...' : '') + '\` |');
}
"

echo ""
echo ""
echo "## Build Configuration"
echo "----------------------"

if [ -f "next.config.mjs" ]; then
    echo "- Next.js config: next.config.mjs"
fi

if [ -f "tsconfig.json" ]; then
    echo "- TypeScript config: tsconfig.json"
fi

if [ -f "docker-compose.yml" ]; then
    echo "- Docker Compose: docker-compose.yml"
fi

if [ -f "Dockerfile" ]; then
    echo "- Dockerfile: Present"
fi


if [ -d "prisma" ]; then
    echo "- Prisma schema: prisma/schema.prisma"
fi

if [ -d "src-tauri" ]; then
    echo "- Tauri config: src-tauri/tauri.conf.json"
fi

echo ""
echo ""
echo "## Supported AI Providers"
echo "-------------------------"

# List providers from api directory
if [ -d "app/api" ]; then
    echo "| Provider | API File |"
    echo "|----------|----------|"
    for file in app/api/*.ts; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            # Skip common files
            if [[ "$filename" != "auth.ts" && "$filename" != "common.ts" && "$filename" != "proxy.ts" ]]; then
                provider=$(echo "$filename" | sed 's/.ts$//')
                echo "| $provider | app/api/$filename |"
            fi
        fi
    done
fi

echo ""
echo ""
echo "## Directory Structure Summary"
echo "------------------------------"
echo "\`\`\`"
echo "app/"
echo "├── api/            # API routes ($(ls -1 app/api/*.ts 2>/dev/null | wc -l | tr -d ' ') files)"
echo "├── client/         # Client-side API"
echo "├── components/     # React components ($(ls -1 app/components/*.tsx 2>/dev/null | wc -l | tr -d ' ') files)"
echo "├── store/          # Zustand stores ($(ls -1 app/store/*.ts 2>/dev/null | wc -l | tr -d ' ') files)"
echo "├── mcp/            # MCP integration"
echo "├── locales/        # i18n translations"
echo "└── styles/         # Global styles"
echo "\`\`\`"

echo ""
echo "=================================="
echo "Report complete."
