import {
  Configuration,
  IPublicClientApplication,
  PopupRequest,
  PublicClientApplication,
} from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * Pulls configuration from NEXT_PUBLIC_AZURE_AD_ environment variables.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_APP_ID || "",
    authority:
      "https://login.microsoftonline.com/" +
      process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || "/redirect",
    postLogoutRedirectUri: "/",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage", // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

// The App ID URI of the backend API.
// If not set, falls back to Client ID (assuming single app registration for both front/back)
const serverAppId = process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID;

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 */
export const loginRequest: PopupRequest = {
  scopes: ["User.Read"], // Consent for Graph User.Read upfront
};

/**
 * Scopes for the Access Token to be sent to the Backend API.
 * This is required for the Backend to perform On-Behalf-Of flow.
 */
export const tokenRequest = {
  scopes: [`api://${serverAppId}/access_as_user`],
};

/**
 * Helper to get the redirect URI.
 */
export const getRedirectUri = () => {
  return typeof window !== "undefined"
    ? window.location.origin + (msalConfig.auth.redirectUri || "")
    : "";
};

/**
 * Get an access token for use with the API server.
 * This is useful for non-React contexts (like api.ts) where hooks cannot be used.
 */
export const getToken = async (
  client: IPublicClientApplication,
): Promise<string | undefined> => {
  const activeAccount = client.getActiveAccount();
  const accounts = client.getAllAccounts();
  const account = activeAccount || (accounts.length > 0 ? accounts[0] : null);

  if (!account) {
    return undefined;
  }

  // Use tokenRequest to get a token specifically for the Backend API
  const request = {
    ...tokenRequest,
    account: account,
  };

  try {
    const response = await client.acquireTokenSilent(request);
    return response.accessToken;
  } catch (error) {
    console.warn("Silent token acquisition failed, attempting popup...", error);
    // In a real app, you might want to trigger a login interaction here or handle it in the UI
    return undefined;
  }
};

/**
 * Retrieves the username of the active account.
 */
export const getUsername = (
  client: IPublicClientApplication,
): string | null => {
  const activeAccount = client.getActiveAccount();
  if (activeAccount) {
    return activeAccount.username;
  }
  const accounts = client.getAllAccounts();
  return accounts.length > 0 ? accounts[0].username : null;
};

// Initialize the MSAL instance (can be used outside of components if needed, but prefer MsalProvider)
export const msalInstance = new PublicClientApplication(msalConfig);
