import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import { ConfidentialClientApplication } from "@azure/msal-node";

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

  const userEmail = ""; // TODO: extract from authToken using msal

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
