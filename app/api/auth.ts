import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

// Configuration (read env once at module load time to avoid repeated process.env calls)
const AZURE_TENANT_ID = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID ?? "";
const AZURE_SERVER_APP_ID =
  process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID ?? "";
const AZURE_SERVER_APP_SECRET = process.env.AZURE_AD_SERVER_APP_SECRET ?? "";
// const AZURE_AUTH_ON_BEHALF_OF_ENABLED = process.env.AZURE_AUTH_ON_BEHALF_OF_ENABLED ?? false;

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isApiKey = !token.startsWith(ACCESS_CODE_PREFIX);

  return {
    accessCode: isApiKey ? "" : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isApiKey ? token : "",
  };
}

// JWKS client with cache at module scope to avoid network overhead for every request
const jwks = AZURE_TENANT_ID
  ? jwksClient({
      jwksUri: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    })
  : undefined;

function getKey(header: any, callback: any) {
  if (!jwks)
    return callback(new Error("Missing or misconfigured Azure tenant id"));
  jwks.getSigningKey(header.kid, (err: any, key: any) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey?.();
    if (!signingKey) return callback(new Error("Signing key not found"));
    callback(null, signingKey);
  });
}

export async function validateAccessToken(token: string) {
  if (!AZURE_TENANT_ID || !AZURE_SERVER_APP_ID) {
    return null;
  }

  const validIssuers = [
    `https://sts.windows.net/${AZURE_TENANT_ID}/`,
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
  ];
  const validAudiences = [`api://${AZURE_SERVER_APP_ID}`, AZURE_SERVER_APP_ID];

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: validAudiences as unknown as [string, ...string[]],
        issuer: validIssuers as unknown as [string, ...string[]],
        algorithms: ["RS256"],
      },
      (err: any, decoded: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      },
    );
  });
}

export type AuthClaimsResult = {
  idTokenClaims: { [k: string]: any };
  accessToken?: string;
};

export async function getAuthClaims(
  token: string,
): Promise<AuthClaimsResult | {}> {
  if (!AZURE_TENANT_ID || !AZURE_SERVER_APP_ID || !AZURE_SERVER_APP_SECRET) {
    return {};
  }

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: AZURE_SERVER_APP_ID,
      clientSecret: AZURE_SERVER_APP_SECRET,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    },
  });

  try {
    const result = await cca.acquireTokenOnBehalfOf({
      oboAssertion: token,
      scopes: ["https://graph.microsoft.com/.default"],
    });
    // Return both idTokenClaims and accessToken (if needed for Graph calls)
    return {
      idTokenClaims: result?.idTokenClaims || {},
      accessToken: result?.accessToken,
    };
  } catch (e) {
    console.error("OBO flow failed", e);
    throw e;
  }
}

export async function getUsernameByToken(token: string) {
  // 1) local JWT validation and claims
  const decoded = (await validateAccessToken(token)) as any;
  if (!decoded) return null;

  // Normalize common fields (preferred_username / upn -> email when appropriate)
  const fromToken =
    decoded?.email || decoded?.preferred_username || decoded?.upn;
  if (fromToken) return fromToken as string;

  // 2) fallback to OBO to get idTokenClaims + accessToken
  try {
    const authClaimsResult = (await getAuthClaims(token)) as any;
    // If getAuthClaims is updated to return { idTokenClaims, accessToken }
    const claims = authClaimsResult?.idTokenClaims || authClaimsResult;
    const fromClaims =
      claims?.email || claims?.preferred_username || claims?.upn;
    if (fromClaims) return fromClaims as string;

    // 3) If we have an accessToken, call Graph /me to retrieve mail/userPrincipalName
    const accessToken = authClaimsResult?.accessToken;
    if (accessToken) {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const json = await res.json();
        return (json?.mail || json?.userPrincipalName || json?.user?.mail) as
          | string
          | null;
      }
    }
  } catch (e) {
    console.error("getUsernameByToken fallback failed", e);
  }

  return null;
}

export async function auth(req: NextRequest, modelProvider: ModelProvider) {
  const authToken = req.headers.get("Authorization") ?? "";

  if (!authToken) {
    return {
      error: true,
      msg: "missing authorization header",
    };
  }

  if (!AZURE_TENANT_ID || !AZURE_SERVER_APP_ID || !AZURE_SERVER_APP_SECRET) {
    return {
      error: true,
      msg: "missing backend AD configuration",
    };
  }

  let username = "";

  try {
    const token = authToken.trim().replace("Bearer ", "").trim();
    // extract username and fall back to OBO/Graph when necessary
    const usernameFromToken = await getUsernameByToken(token);
    username = usernameFromToken || "";
    console.log("[Auth] Authenticated user:", username);
  } catch (e: any) {
    console.error("[Auth] Azure AD validation failed", e);
    if (e.name === "TokenExpiredError") {
      return {
        error: true,
        msg: "Token expired",
      };
    }
    return {
      error: true,
      msg: "Invalid Azure AD token",
    };
  }

  if (!username) {
    return {
      error: true,
      msg: "Unable to retrieve user information from token",
    };
  }

  const serverConfig = getServerSideConfig();
  const systemApiKey = ""; // serverConfig.apiKey;

  if (systemApiKey) {
    console.log("[Auth] use system api key");
    req.headers.set("Authorization", `Bearer ${systemApiKey}`);
  } else {
    console.log("[Auth] admin did not provide an api key");
  }
  return {
    error: false,
  };
}
