import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import * as crypto from "crypto";
import { max } from "lodash-es";

// Configuration (read env once at module load time to avoid repeated process.env calls)
const AZURE_TENANT_ID = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID ?? "";
const AZURE_SERVER_APP_ID =
  process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID ?? "";
const AZURE_SERVER_APP_SECRET = process.env.AZURE_AD_SERVER_APP_SECRET ?? "";
const LITELLM_BASE_URL = process.env.BASE_URL ?? "";
const LITELLM_API_KEY = process.env.OPENAI_API_KEY ?? "";
const salt = process.env.AZURE_AUTH_KEY_GEN_SALT ?? "wxioaq";
// const AZURE_AUTH_ON_BEHALF_OF_ENABLED = process.env.AZURE_AUTH_ON_BEHALF_OF_ENABLED ?? false;
const year = new Date().getFullYear();

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
    const userKey = getKeyByUsername(username);
    let llmData = await getLLMKey(userKey);
    let llmKey = llmData?.key as string | null;
    if (!llmKey) {
      llmData = await generateKey(userKey, username);
      llmKey = llmData?.key as string | null;
    }
    // console.log(`[Auth] User: ${username}, LLM Key: ${llmKey}, Spend: ${llmData.spend}, data: ${JSON.stringify(llmData)}`);
    req.headers.set("Authorization", `Bearer ${llmKey}`);
    req.headers.set("spend", llmData?.spend ?? 0);
    req.headers.set("budget", llmData?.max_budget ?? 1);
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
      msg: "Invalid Login Auth token",
    };
  }

  if (!username) {
    return {
      error: true,
      msg: "Unable to retrieve user information from token",
    };
  }

  return {
    error: false,
  };
}

export function getKeyByUsername(username: string): string {
  // Use MD5 hash of username+year+salt as the key
  const hash =
    "sk-" +
    crypto
      .createHash("md5")
      .update(username + year + salt)
      .digest("hex");
  return hash;
}

export async function getLLMKey(key: any): Promise<any> {
  const getKeyUrl = `${LITELLM_BASE_URL}/key/info?key=${key}`;
  try {
    const res = await fetch(getKeyUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LITELLM_API_KEY}`,
      },
      method: "GET",
    });
    if (res.ok) {
      const data = await res.json();
      // console.log(`[getLLMKey] Retrieved data for ${JSON.stringify(data)}`);
      return { key: data.key, ...data.info };
    } else {
      const err = await res.json();
      console.error(
        `[getLLMKey] Failed to get key for ${key}, err: ${JSON.stringify(err)}`,
      );
      return null;
    }
  } catch (e) {
    console.error(`[getLLMKey] Error fetching key for ${key}`, e);
    return null;
  }
}

// TODO: llm/key/list?key_alias=jackxia@hsu.edu.hk&return_full_object=true

export async function generateKey(key: string, username: string): Promise<any> {
  const generateKeyUrl = `${LITELLM_BASE_URL}/key/generate`;
  const body = {
    key: key,
    team_id: "team-users",
    metadata: { year, username },
    max_budget: 1.0,
    budget_duration: "1mo",
    max_parallel_requests: 2,
    rpm_limit: 10,
    key_alias: username,
    // tpm_limit: 20000,
    // models: [],
    // key_type: "read_only", //llm_api, management, read_only, default
    // duration: "30d", // TODO: Set Key validity duration
  };

  try {
    const res = await fetch(generateKeyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LITELLM_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      // console.log(`[generateKey] Generated key for ${JSON.stringify(data)}`);
      return data;
    } else {
      console.error(
        `[generateKey] Failed to generate key for ${key}, err: ${JSON.stringify(
          await res.json(),
        )}`,
      );
      return null;
    }
  } catch (e) {
    console.error(`[generateKey] Error generating key for ${key}`, e);
    return null;
  }
}

async function handle(req: NextRequest) {
  return NextResponse.json({ status: req });
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
