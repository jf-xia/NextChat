import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

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

async function validateAccessToken(token: string) {
  const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
  const serverAppId = process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID;

  if (!tenantId || !serverAppId) {
    return null;
  }

  const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  });

  function getKey(header: any, callback: any) {
    client.getSigningKey(header.kid, function (err, key) {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  const validIssuers = [
    `https://sts.windows.net/${tenantId}/`,
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
  ];
  const validAudiences = [`api://${serverAppId}`, serverAppId];

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: validAudiences as unknown as [string, ...string[]],
        issuer: validIssuers as unknown as [string, ...string[]],
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

async function getAuthClaims(token: string) {
  const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
  const serverAppId = process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID;
  const serverAppSecret = process.env.AZURE_AD_SERVER_APP_SECRET;

  if (!tenantId || !serverAppId || !serverAppSecret) {
    return {};
  }

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: serverAppId,
      clientSecret: serverAppSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  try {
    const result = await cca.acquireTokenOnBehalfOf({
      oboAssertion: token,
      scopes: ["https://graph.microsoft.com/.default"],
    });
    return result?.idTokenClaims || {};
  } catch (e) {
    console.error("OBO flow failed", e);
    throw e;
  }
}

export async function auth(req: NextRequest, modelProvider: ModelProvider) {
  const authToken = req.headers.get("Authorization") ?? "";

  if (!authToken) {
    return {
      error: true,
      msg: "missing authorization header",
    };
  }

  // get User.Read on behalf of user token using @azure/msal-node, using configs from .env:
  // NEXT_PUBLIC_AZURE_AD_TENANT_ID
  // NEXT_PUBLIC_AZURE_AD_CLIENT_APP_ID
  // AZURE_AD_CLIENT_APP_SECRET
  // NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID
  // AZURE_AD_SERVER_APP_SECRET
  // NEXT_PUBLIC_AZURE_AD_REDIRECT_URI

  let userEmail = "";
  if (process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID) {
    try {
      const token = authToken.trim().replace("Bearer ", "").trim();
      await validateAccessToken(token);
      const claims = (await getAuthClaims(token)) as any;
      userEmail = (claims?.preferred_username ||
        claims?.upn ||
        claims?.email) as string;
      console.log("[Auth] Authenticated user:", userEmail);
    } catch (e) {
      console.error("[Auth] Azure AD validation failed", e);
      return {
        error: true,
        msg: "Invalid Azure AD token",
      };
    }
  }

  const serverConfig = getServerSideConfig();
  const systemApiKey = ""; //serverConfig.apiKey;

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
