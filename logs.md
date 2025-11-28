Question:
參考下面的Authentication Flow文檔, 給出一個修改當前auth的方案, 當前系統使用accessCode來進行身份驗證. 現在需要改成使用OAuth2.0來進行身份驗證. 請給出詳細的修改方案, 包括前端auth等頁面和後端api/auth等的修改細節. 方案為AzureOAuthSolution.md 文件 需要輸出為markdown格式. 

# Azure OAuth2.0 implementation

## Frontend Authentication

### The frontend uses MSAL.js with configuration fetched from /auth_setup endpoint authConfig.ts:

// Fetch the auth setup JSON data from the API if not already cached
async function fetchAuthSetup(): Promise<AuthSetup> {
    const response = await fetch("/auth_setup");
    if (!response.ok) {
        throw new Error(`auth setup response was not ok: ${response.status}`);
    }
    return await response.json();
}

const authSetup = await fetchAuthSetup();

export const useLogin = authSetup.useLogin;

export const requireAccessControl = authSetup.requireAccessControl;

export const enableUnauthenticatedAccess = authSetup.enableUnauthenticatedAccess;

export const requireLogin = requireAccessControl && !enableUnauthenticatedAccess;

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig = authSetup.msalConfig;

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://learn.microsoft.com/entra/identity-platform/permissions-consent-overview#openid-connect-scopes
 */
export const loginRequest = authSetup.loginRequest;

const tokenRequest = authSetup.tokenRequest;

// Build an absolute redirect URI using the current window's location and the relative redirect URI from auth setup
export const getRedirectUri = () => {
    return window.location.origin + authSetup.msalConfig.auth.redirectUri;
};


### The AuthenticationHelper.get_auth_setup_for_client() method provides MSAL configuration authentication:

    def get_auth_setup_for_client(self) -> dict[str, Any]:
        # returns MSAL.js settings used by the client app
        return {
            "useLogin": self.use_authentication,  # Whether or not login elements are enabled on the UI
            "requireAccessControl": self.enforce_access_control,  # Whether or not access control is required to access documents with access control lists
            "enableUnauthenticatedAccess": self.enable_unauthenticated_access,  # Whether or not the user can access the app without login
            "msalConfig": {
                "auth": {
                    "clientId": self.client_app_id,  # Client app id used for login
                    "authority": self.authority,  # Directory to use for login https://learn.microsoft.com/entra/identity-platform/msal-client-application-configuration#authority
                    "redirectUri": "/redirect",  # Points to window.location.origin. You must register this URI on Azure Portal/App Registration.
                    "postLogoutRedirectUri": "/",  # Indicates the page to navigate after logout.
                    "navigateToLoginRequestUrl": False,  # If "true", will navigate back to the original request location before processing the auth code response.
                },
                "cache": {
                    # Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
                    "cacheLocation": "localStorage",
                    # Set this to "true" if you are having issues on IE11 or Edge
                    "storeAuthStateInCookie": False,
                },
            },
            "loginRequest": {
                # Scopes you add here will be prompted for user consent during sign-in.
                # By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
                # For more information about OIDC scopes, visit:
                # https://learn.microsoft.com/entra/identity-platform/permissions-consent-overview#openid-connect-scopes
                "scopes": [".default"],
                # Uncomment the following line to cause a consent dialog to appear on every login
                # For more information, please visit https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow#request-an-authorization-code
                # "prompt": "consent"
            },
            "tokenRequest": {
                "scopes": [f"api://{self.server_app_id}/access_as_user"],
            },
        }

## Backend Token Validation
The AuthenticationHelper class handles:

### Token extraction from Authorization header or App Services header authentication:

    @staticmethod
    def get_token_auth_header(headers: dict) -> str:
        # Obtains the Access Token from the Authorization Header
        auth = headers.get("Authorization")
        if auth:
            parts = auth.split()

            if parts[0].lower() != "bearer":
                raise AuthError(error="Authorization header must start with Bearer", status_code=401)
            elif len(parts) == 1:
                raise AuthError(error="Token not found", status_code=401)
            elif len(parts) > 2:
                raise AuthError(error="Authorization header must be Bearer token", status_code=401)

            token = parts[1]
            return token

        # App services built-in authentication passes the access token directly as a header
        # To learn more, please visit https://learn.microsoft.com/azure/app-service/configure-authentication-oauth-tokens
        token = headers.get("x-ms-token-aad-access-token")
        if token:
            return token

        raise AuthError(error="Authorization header is expected", status_code=401)


### On-Behalf-Of flow to acquire Azure Search tokens authentication:

    async def check_path_auth(self, path: str, auth_claims: dict[str, Any], search_client: SearchClient) -> bool:
        # If there was no access control or no path, then the path is allowed
        if not self.enforce_access_control or len(path) == 0:
            return True

        # Remove any fragment string from the path before checking
        fragment_index = path.find("#")
        if fragment_index != -1:
            path = path[:fragment_index]

        # Filter down to only chunks that are from the specific source file
        # Sourcepage is used for GPT-4V
        # Replace ' with '' to escape the single quote for the filter
        # https://learn.microsoft.com/azure/search/query-odata-filter-orderby-syntax#escaping-special-characters-in-string-constants
        path_for_filter = path.replace("'", "''")
        filter = f"(sourcefile eq '{path_for_filter}') or (sourcepage eq '{path_for_filter}')"

        # If the filter returns any results, the user is allowed to access the document
        # Otherwise, access is denied
        results = await search_client.search(
            search_text="*", top=1, filter=filter, x_ms_query_source_authorization=auth_claims["access_token"]
        )
        allowed = False
        async for _ in results:
            allowed = True
            break

        return allowed


## Access Control Enforcement

Routes use @authenticated decorator to validate tokens decorators.py:

def authenticated(route_fn: _C) -> _C:
    """
    Decorator for routes that might require access control. Unpacks Authorization header information into an auth_claims dictionary
    """

    @wraps(route_fn)
    async def auth_handler(*args, **kwargs):
        auth_helper = current_app.config[CONFIG_AUTH_CLIENT]
        try:
            auth_claims = await auth_helper.get_auth_claims_if_enabled(request.headers)
        except AuthError:
            abort(403)

        return await route_fn(auth_claims, *args, **kwargs)

    return cast(_C, auth_handler)

------------------------

Suloutions:

## NextChat 使用 Azure OAuth2.0 替换 AccessCode 的整体方案

### 1. 背景与目标
- **现状**：前端 `AuthPage` 依赖 `accessStore.accessCode`，后端 `app/api/auth.ts` 通过 `CODE` 环境变量校验 access code 并注入系统 API Key。
- **痛点**：access code 容易泄露，无法与企业身份策略集成，也无法支持细粒度访问控制和审计。
- **目标**：复用参考的 Authentication Flow，引入 Azure AD OAuth2.0 + MSAL.js，实现登录、Token 下发与验证、对下游 Azure 资源的 OBO（On-Behalf-Of）访问。
- **成功标准**：
	1. 未登录用户无法访问受限页面，MSAL 登录后自动携带 Bearer Token 调用 API。
	2. 后端接受/验证来自 Azure AD 的 Access Token，可根据 `roles`/`groups` 强制访问控制。
	3. 系统保留无认证模式（`enableUnauthenticatedAccess`），但默认开启 OAuth 登录。
	4. 方案包含配置、迁移、测试与回滚路径。

### 2. 目标架构概览
1. **配置下发**：新增 `/api/auth_setup`（代理 `AuthenticationHelper.get_auth_setup_for_client`），前端初始化 MSAL。
2. **浏览器**：使用 `@azure/msal-browser` + context provider 管理登录状态，`AuthPage` 改为 Login/Logout UI。
3. **API 路径保护**：
	 - 在 Next `middleware.ts`（或 API 装饰器）中调用 `AuthenticationHelper.get_token_auth_header` + `get_auth_claims_if_enabled`。
	 - 各 API（含 `app/api/chat`, `app/api/proxy/...`）复用 `authenticated` 中间件逻辑。
4. **下游资源访问**：后端通过 OBO 流程（利用 `tokenRequest` scopes）获取 Azure 令牌, scopes 包括 User.Read & Files.ReadWrite.All。
5. **会话存储**：前端仅保留 MSAL 缓存 (localStorage/sessionStorage)，不再存储 access code；可选将 `account` 基本信息缓存在 `authStore`。

```
Browser(AuthPage) ──MSAL login──> Azure AD ──auth code──> /api/auth/callback
	 │                                             │
	 └──Bearer token──> API Route ──validated──> downstream services (User.Read, Files.ReadWrite.All, etc.)
```

### 3. 依赖与配置

.env 已配置 Azure OAuth 环境变量有:

- AZURE_AD_TENANT_ID
- AZURE_AD_CLIENT_APP_ID
- AZURE_AD_CLIENT_APP_SECRET
- AZURE_AD_SERVER_APP_ID
- AZURE_AD_SERVER_APP_SECRET
- AZURE_AD_REDIRECT_URI

package.json 已安裝:
    "@azure/msal-browser": "^4.26.2",
    "@azure/msal-react": "^3.0.22",
    "@azure/msal-node": "^3.8.3",

| 模块         | 变更                                             | 说明               |
| ------------ | ------------------------------------------------ | ------------------ |
| `Dockerfile` | 暴露新的 `redirectUri` & `postLogoutRedirectUri` | 确保云端配置一致。 |

### 4. 前端改造

#### 4.1 MSAL 初始化
1. 新增 `app/auth/authConfig.ts`：
	 ```ts
	 import { PublicClientApplication } from "@azure/msal-browser";
	 const authSetup = await fetch("/api/auth_setup").then((r) => r.json());
	 export const msalInstance = new PublicClientApplication(authSetup.msalConfig);
	 export const loginRequest = authSetup.loginRequest;
	 ```
2. 新增 `AuthProvider`（`app/providers/AuthProvider.tsx`）：封装 `MsalProvider`，在 `app/layout.tsx` 或入口包裹全局。

#### 4.2 Store 与上下文
- 新建 `useAuthStore`（或扩展 `accessStore`）：字段包括 `account`, `idToken`, `claims`, `isLoading`, `requireLogin`。
- 在 `AuthProvider` 中调用 `msalInstance.initialize().then(instance.handleRedirectPromise)`，根据结果更新 store。

#### 4.3 AuthPage & UI
- 删除 access code 输入框，改为：
	- **Login**：调用 `instance.loginRedirect(loginRequest)` 或 `loginPopup`；显示登录状态（头像/名称）。
	- **Logout**：`instance.logoutRedirect`。
	- **继续访问**按钮仅在 `account` 存在时可用。
- 若 `enableUnauthenticatedAccess` 为 true，提供“以访客身份继续”按钮。

#### 4.4 API 调用适配
1. `app/client/api.ts`、`app/store/access.ts`：
	 - 移除 `accessCode` 逻辑，改为调用 `await msalInstance.acquireTokenSilent(tokenRequest)`；若失败 fallback `loginRedirect`。
	 - 在 `fetch`/`axios` 请求头注入 `Authorization: Bearer {token}`。
2. `app/components/chat.tsx`、`chat-list.tsx` 等读取 `accessStore.accessCode` 的地方全部切换为 `authStore.requireLogin` 判断逻辑。

#### 4.5 路由守卫 & 错误处理
- 在路由配置中添加 `withAuthGuard`：
	```ts
	export function withAuthGuard(Component) {
		return function Guarded(props) {
			const { requireLogin, account } = useAuthStore();
			if (requireLogin && !account) return <AuthPage mode="login" />;
			return <Component {...props} />;
		};
	}
	```
- 对 `401/403` 响应统一捕获：提示重新登录或申请权限。

### 5. 后端改造

#### 5.1 AuthenticationHelper (Node 版本)
- 在 `app/server/authentication.ts` 新建 TypeScript 类，等价实现参考文档中的 Python 版本：
	- `get_auth_setup_for_client()`：读取环境变量构造 `msalConfig/loginRequest/tokenRequest`，返回给前端。
	- `get_token_auth_header(headers)`：从 Authorization 或 `x-ms-token-aad-access-token` 抽取 Bearer。
	- `get_auth_claims_if_enabled(headers)`：
		1. 若 `use_authentication=false`，直接返回 `{}`。
		2. 使用 `@azure/msal-node` 或 `jsonwebtoken` + Azure 公钥 (JWKS) 校验 Access Token。
		3. 将 `oid`, `preferred_username`, `roles`, `scp` 等 claim 注入。
	- `acquire_token_on_behalf_of()`：实现 OBO，用于调用 Azure Search/Storage（需要 `server_app_id` 与 client secret）。

#### 5.2 新增/修改 API Route
| 路径                           | 作用 | 细节                                                                  |
| ------------------------------ | ---- | --------------------------------------------------------------------- |
| `app/api/auth_setup/route.ts`  | GET  | 返回 `AuthenticationHelper.get_auth_setup_for_client()`，供前端缓存。 |
| `app/api/auth/token/route.ts`  | POST | 代理 OBO，输入 `targetResource`，输出下游访问令牌。                   |
| `app/api/auth/logout/route.ts` | POST | 清理服务端会话（如使用 cookie/session）。                             |
| 现有 `app/api/auth.ts`         | 改造 | 不再校验 access code，转为仅负责 API Key 注入 & token 透传。          |

#### 5.3 路由保护
- 在 `middleware.ts` 中拦截 `/api/*`：
	1. 读取 Authorization。
	2. 调用 `AuthenticationHelper.get_token_auth_header` + `verify_token`。
	3. 校验 `enforce_access_control` 时的 `roles`/`groups`。
	4. 将 `auth_claims` 通过 `requestHeaders.set("x-auth-claims", JSON.stringify(claims))` 传递给下游 handler。
- 各 API handler 通过新建的 `withAuthClaims` helper 解析头部。

### 6. 配置与部署步骤
1. **Azure AD**：
	 - 注册两个应用：`Client App (SPA)` + `Server App (web/API)`。
	 - 配置权限：`Client` 使用授权码流 + PKCE，`Server` 暴露 scope `access_as_user`。
	 - 在 Portal 中设置 `redirectUri = https://<domain>/redirect`，`postLogoutRedirectUri = https://<domain>/`。
	 - azure AUTHORITY=https://login.microsoftonline.com/<tenantId>
2. **环境变量**：
	 ```dotenv
	 AZURE_AD_CLIENT_ID=
	 AZURE_AD_TENANT_ID=
	 AZURE_AD_REDIRECT_URI=/redirect
	 AZURE_AD_POST_LOGOUT_URI=/
	 AZURE_AD_SERVER_APP_ID=
	 AZURE_AD_SERVER_APP_SECRET=
	 REQUIRE_ACCESS_CONTROL=true
	 ENABLE_UNAUTHENTICATED_ACCESS=false
	 ```
3. **MSAL 缓存策略**：默认 `localStorage`。

### 7. 任务拆分 (不包含測試和監控)

1. **阶段一**：底层能力（AuthenticationHelper、auth_setup、MSAL Provider）。
   1. 实现并测试 `AuthenticationHelper` 的各项方法。
      1. 实现 `get_auth_setup_for_client`。
      2. 
   2. 创建并验证 `/api/auth_setup` 路由。
      1. 实现路由处理函数。
      2. 
   3. 搭建 `AuthProvider`，确保 MSAL 能正确初始化并处理重定向。
      1. 实现 `AuthProvider` 组件。
      2. 验证 MSAL 初始化与重定向处理。
      3. 
   4. 编写 `useAuthStore`，管理认证状态。
      1. 实现 `useAuthStore`。
      2. 验证状态管理逻辑。
      3. 
   5. 完成基本的登录/登出 UI 逻辑。
      1. 实现 `AuthPage` 的登录/登出功能。
      2. 
   6. 编写路由守卫 `withAuthGuard`。
      1. 实现 `withAuthGuard` 高阶组件。
      2. 
   7. 修改 API 调用逻辑，集成 MSAL Token 获取与注入。
      1. 更新 API 调用代码。
      2. 
   8. 编写后端中间件，保护 API 路由。
      1. 实现中间件逻辑。
      2. 
2. **阶段二**：前端 UI/Store & API 调用改造。
   1. 更新 `AuthPage`，移除 access code 相关逻辑。
      1. 实现 UI 变更。
      2. 
   2. 修改 API 调用逻辑，集成 MSAL Token 获取与注入 `withAuthGuard` 到受保护页面。
      1. 更新 API 调用代码。
      2. 
   3. 编写错误处理逻辑，处理 401/403 响应。
      1. 实现错误处理机制。
      2. 
3. **阶段三**：OBO + Access Control。
   1. 实现 OBO 流程，确保后端能获取下游资源令牌。
      1. 实现 OBO 方法。
      2. 使用 User.Read 验证 OBO 流程。
      3. 
   2. 在关键 API 中集成访问控制逻辑。
      1. 更新 API 处理函数。
      2. 
