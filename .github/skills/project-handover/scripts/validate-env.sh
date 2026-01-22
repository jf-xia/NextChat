#!/bin/bash
#
# validate-env.sh
# Validates the .env.local file configuration
#
# Usage: ./validate-env.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Environment Configuration Validator"
echo "======================================="

# Check if .env.local exists
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env" ]; then
        ENV_FILE=".env"
        echo -e "${YELLOW}Using .env (production) instead of .env.local${NC}"
    else
        echo -e "${RED}✗ No .env.local or .env file found${NC}"
        echo ""
        echo "Create one by copying the example:"
        echo "  cp .env.example .env.local"
        exit 1
    fi
fi

echo "Checking: $ENV_FILE"
echo ""

# Track issues
WARNINGS=0
ERRORS=0
HAS_PROVIDER=0

# Function to check if variable exists and has value
check_var() {
    local var_name=$1
    local required=$2
    local description=$3
    
    if grep -q "^${var_name}=" "$ENV_FILE"; then
        value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d'=' -f2-)
        if [ -n "$value" ] && [ "$value" != '""' ] && [ "$value" != "''" ]; then
            # Mask sensitive values
            if [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"SECRET"* ]]; then
                masked="${value:0:4}...${value: -4}"
                echo -e "${GREEN}✓${NC} $var_name = $masked"
            else
                echo -e "${GREEN}✓${NC} $var_name = $value"
            fi
            return 0
        fi
    fi
    
    if [ "$required" = "required" ]; then
        echo -e "${RED}✗${NC} $var_name - $description"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        echo -e "${YELLOW}○${NC} $var_name - $description (optional)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

# Function to check provider
check_provider() {
    local var_name=$1
    local provider=$2
    
    if grep -q "^${var_name}=" "$ENV_FILE"; then
        value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d'=' -f2-)
        if [ -n "$value" ] && [ "$value" != '""' ] && [ "$value" != "''" ]; then
            masked="${value:0:4}...${value: -4}"
            echo -e "${GREEN}✓${NC} $var_name = $masked ($provider)"
            HAS_PROVIDER=1
            return 0
        fi
    fi
    return 1
}

echo "📌 Security Configuration"
echo "-------------------------"
check_var "CODE" "recommended" "Access password (recommended for security)"

echo ""
echo "🤖 AI Provider Keys (at least one required)"
echo "--------------------------------------------"

# Check all providers
check_provider "OPENAI_API_KEY" "OpenAI"
check_provider "ANTHROPIC_API_KEY" "Anthropic Claude"
check_provider "GOOGLE_API_KEY" "Google Gemini"
check_provider "AZURE_API_KEY" "Azure OpenAI"
check_provider "DEEPSEEK_API_KEY" "DeepSeek"
check_provider "BAIDU_API_KEY" "Baidu ERNIE"
check_provider "ALIBABA_API_KEY" "Alibaba Qwen"
check_provider "BYTEDANCE_API_KEY" "ByteDance"
check_provider "MOONSHOT_API_KEY" "Moonshot"
check_provider "AI302_API_KEY" "302.AI"
check_provider "CHATGLM_API_KEY" "ChatGLM"
check_provider "XAI_API_KEY" "XAI"
check_provider "SILICONFLOW_API_KEY" "SiliconFlow"

if [ $HAS_PROVIDER -eq 0 ]; then
    echo ""
    echo -e "${RED}✗ No AI provider configured!${NC}"
    echo "  At least one API key is required."
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "⚙️  Optional Configuration"
echo "--------------------------"
check_var "BASE_URL" "optional" "Custom OpenAI API endpoint"
check_var "ENABLE_MCP" "optional" "Enable Model Context Protocol"
check_var "HIDE_USER_API_KEY" "optional" "Hide user API key input"
check_var "DISABLE_GPT4" "optional" "Disable GPT-4 access"

echo ""
echo "🔍 Security Checks"
echo "------------------"

# Check for exposed secrets in git
if [ -f ".gitignore" ]; then
    if grep -q ".env.local" .gitignore; then
        echo -e "${GREEN}✓${NC} .env.local is in .gitignore"
    else
        echo -e "${RED}✗${NC} .env.local is NOT in .gitignore - SECURITY RISK!"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check for hardcoded keys in files (basic check)
if grep -rq "sk-[a-zA-Z0-9]\{20,\}" --include="*.ts" --include="*.tsx" --include="*.js" app/ 2>/dev/null; then
    echo -e "${RED}✗${NC} Possible hardcoded API key found in source code!"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} No obvious hardcoded keys in source"
fi

echo ""
echo "======================================="

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗ Validation failed with $ERRORS error(s)${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Validation passed with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${GREEN}✓ All configuration validated successfully!${NC}"
    exit 0
fi
