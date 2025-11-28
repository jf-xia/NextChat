# Azure OAuth2.0 implementation

## NextChat 使用 Azure OAuth2.0 替换 AccessCode 的整体方案

### 1. 背景与目标
- **现状**：前端 `AuthPage` 依赖 `accessStore.accessCode`，后端通过 `CODE` 环境变量校验。
- **目标**：引入 Azure AD OAuth2.0 + MSAL.js，替代 Access Code。
- **变更点**：
    1. **配置方式**：配置直接通过 `AZURE_AD_` 环境变量注入前端。
    2. **验证方式**：沿用现有 Access Code 的验证风格（在 API Route 内部调用验证函数），使用 Next.js Middleware。
    3. **访客模式**：**彻底移除**，强制要求登录。
    4. **状态管理**：直接使用 MSAL 官方推荐的 `useMsal()` hook 和 MsalProvider。
    5. **Scope**：初期仅实现 On behalf of 獲取 `User.Read`。

### 2. 目标架构概览
1. **配置**：构建时通过环境变量注入 MSAL 配置。
2. **前端**：`AuthProvider` 初始化 MSAL，`api.ts` 拦截请求调用 `acquireTokenSilent` 自动处理 Token 刷新。
3. **后端验证**：API Route (如 `app/api/chat/route.ts`) 显式调用 `auth()` 函数，该函数改为校验 Bearer Token 签名。
4. **下游资源**：后端通过 Token 获取用户信息 (User.Read)。

### 3. 依赖与配置

**.env / .env.local**:
```dotenv
# Frontend Config (Exposed to browser)
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_REDIRECT_URI=/redirect
AZURE_AD_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
# Backend App ID URI for OBO flow (e.g. api://<backend-client-id>)
AZURE_AD_SERVER_APP_ID=<server-app-id>

前端內置auth_setup
{
    "enableUnauthenticatedAccess": false,
    "loginRequest": {
        "scopes": [
            ".default"
        ]
    },
    "msalConfig": {
        "auth": {
            "authority": "https://login.microsoftonline.com/{AZURE_AD_TENANT_ID}",
            "clientId": "{AZURE_AD_CLIENT_APP_ID}",
            "navigateToLoginRequestUrl": false,
            "postLogoutRedirectUri": "/",
            "redirectUri": "/redirect"
        },
        "cache": {
            "cacheLocation": "localStorage",
            "storeAuthStateInCookie": false
        }
    },
    "requireAccessControl": false,
    "tokenRequest": {
        "scopes": [
            "api://{AZURE_AD_SERVER_APP_ID}/access_as_user"
        ]
    },
    "useLogin": true
}
```

## 任务拆分

1.  **环境与配置准备** (已完成)
    *   在 `.env` 中配置 `AZURE_AD_*` 变量
    *   安装依赖：`npm install @azure/msal-browser @azure/msal-react`。

2.  **前端基础建设**
    *   **创建 `app/auth/authConfig.ts`**:
        *   定义 `msalConfig`。
        *   定义 `loginRequest` (基础用户信息) 和 **`tokenRequest` (后端 API Scope)**。
        *   封装 `getToken(client)` 方法，**使用 `tokenRequest` 获取 API 专用 Token**。
    *   **集成 Provider (`app/layout.tsx`)**:
        *   初始化 `PublicClientApplication` 实例。
        *   使用 `MsalProvider` 包裹应用根组件。
    *   **改造 API Client (`app/client/api.ts`)**:
        *   引入 `msalInstance` (从 `authConfig` 或单例导出)。
        *   在 `makeRequest` 或拦截器中，调用 `getToken` 获取 Bearer Token。
        *   将 Token 添加到 `Authorization` 请求头。

3.  **前端 UI 与路由**
    *   **改造 `AuthPage`**:
        *   移除 Access Code 输入框。
        *   添加 "Login with Microsoft" 按钮，点击调用 `instance.loginPopup(loginRequest)`。
    *   **路由保护**:
        *   在 `Home` 组件或全局 Layout 中检查 `useMsal().accounts`。
        *   若未登录，渲染 `AuthPage` 或重定向。
    *   **移除访客模式**: 删除相关 UI 开关和逻辑判断。

4.  **后端验证改造**
    *   **更新 `app/api/chat/route.ts`**:
        *   移除 `CODE` 环境变量校验。
        *   引入 JWT 验证库 (如 `jose`)。
        *   实现 `auth(req)` 函数：解析 `Authorization` 头，验证 Azure AD 签名和过期时间。
        *   解析 Token 获取用户信息 (OID, Name) 用于审计或上下文。



