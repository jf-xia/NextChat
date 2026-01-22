#!/bin/bash
#
# check-dependencies.sh
# Validates that all required development dependencies are installed
#
# Usage: ./check-dependencies.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking development environment dependencies..."
echo "=================================================="

# Track failures
FAILED=0

# Function to check command existence
check_command() {
    local cmd=$1
    local min_version=$2
    local install_hint=$3
    
    if command -v "$cmd" &> /dev/null; then
        version=$($cmd --version 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $cmd: $version"
    else
        echo -e "${RED}✗${NC} $cmd: Not found"
        echo -e "  ${YELLOW}Install:${NC} $install_hint"
        FAILED=1
    fi
}

# Function to check Node.js version
check_node_version() {
    if command -v node &> /dev/null; then
        node_version=$(node --version | cut -d'v' -f2)
        major_version=$(echo "$node_version" | cut -d'.' -f1)
        
        if [ "$major_version" -ge 18 ]; then
            echo -e "${GREEN}✓${NC} Node.js: v$node_version (>= 18 required)"
        else
            echo -e "${RED}✗${NC} Node.js: v$node_version (>= 18 required)"
            echo -e "  ${YELLOW}Update:${NC} nvm install 20 && nvm use 20"
            FAILED=1
        fi
    fi
}

echo ""
echo "📦 Required Tools:"
echo "------------------"

# Check Node.js
check_node_version

# Check Yarn
check_command "yarn" "1.22" "npm install -g yarn"

# Check Git
check_command "git" "2.30" "https://git-scm.com/downloads"

echo ""
echo "📦 Optional Tools:"
echo "------------------"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    docker_version=$(docker --version 2>&1)
    echo -e "${GREEN}✓${NC} Docker: $docker_version"
else
    echo -e "${YELLOW}○${NC} Docker: Not found (optional for containerized deployment)"
fi

# Check npm (usually comes with Node)
if command -v npm &> /dev/null; then
    npm_version=$(npm --version 2>&1)
    echo -e "${GREEN}✓${NC} npm: v$npm_version"
fi

echo ""
echo "📁 Project Files:"
echo "-----------------"

# Check if in project root
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} package.json found"
else
    echo -e "${RED}✗${NC} package.json not found - are you in the project root?"
    FAILED=1
fi

# Check for node_modules
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}○${NC} node_modules not found - run 'yarn install'"
fi

# Check for .env.local
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
    
    # Check for required env vars
    if grep -q "OPENAI_API_KEY" .env.local; then
        echo -e "${GREEN}✓${NC} OPENAI_API_KEY is configured"
    else
        echo -e "${YELLOW}○${NC} OPENAI_API_KEY not found in .env.local"
    fi
else
    echo -e "${YELLOW}○${NC} .env.local not found - copy from .env.example"
fi

echo ""
echo "=================================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All required dependencies are installed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. yarn install    # Install npm dependencies"
    echo "  2. yarn dev        # Start development server"
    exit 0
else
    echo -e "${RED}✗ Some required dependencies are missing.${NC}"
    echo "Please install the missing tools and run this script again."
    exit 1
fi
