"use client";
import {
  ApiPath,
  OPENAI_BASE_URL,
  OpenaiPath,
  Azure,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
} from "@/app/constant";
import { useAccessStore, useAppConfig } from "@/app/store";
import { collectModelsWithDefaultModel } from "@/app/utils/model";
import { uploadImage, base64Image2Blob } from "@/app/utils/chat";
import { cloudflareAIGatewayUrl } from "@/app/utils/cloudflare";
import { ModelSize, DalleQuality, DalleStyle } from "@/app/typing";
import { ChatOptions, getHeaders } from "../api";
import { getMessageTextContent } from "@/app/utils";
import { fetch } from "@/app/utils/stream";

export interface DalleRequestPayload {
  model: string;
  prompt: string;
  response_format: "url" | "b64_json";
  n: number;
  size: ModelSize;
  quality: DalleQuality;
  style: DalleStyle;
}

export interface ImageRequestPayload {
  model: string;
  prompt: string;
  output_format: "png";
  n: number;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high";
}

export async function extractImageMessage(res: any) {
  if (res.error) {
    return "```json\n" + JSON.stringify(res, null, 4) + "\n```";
  }
  if (res.data) {
    let url = res.data?.at(0)?.url ?? "";
    const b64_json = res.data?.at(0)?.b64_json ?? "";
    if (!url && b64_json) {
      url = await uploadImage(base64Image2Blob(b64_json, "image/png"));
    }
    return [
      {
        type: "image_url",
        image_url: {
          url,
        },
      },
    ];
  }
  return res.choices?.at(0)?.message?.content ?? res;
}

function buildPathFromConfig(modelConfig: any, useAzure = false) {
  let baseUrl = "";
  const accessStore = useAccessStore.getState();
  const isAzure = useAzure;
  if (accessStore.useCustomConfig) {
    if (isAzure && !accessStore.isValidAzure()) {
      throw Error(
        "incomplete azure config, please check it in your settings page",
      );
    }
    baseUrl = isAzure ? accessStore.azureUrl : accessStore.openaiUrl;
  }
  if (baseUrl.length === 0) {
    const isApp = !!(typeof window !== "undefined" && (window as any).__clientConfig?.isApp);
    const apiPath = isAzure ? ApiPath.Azure : ApiPath.OpenAI;
    baseUrl = isApp ? OPENAI_BASE_URL : apiPath;
  }
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, baseUrl.length - 1);
  if (!baseUrl.startsWith("http") && !isAzure && !baseUrl.startsWith(ApiPath.OpenAI)) {
    baseUrl = "https://" + baseUrl;
  }
  const path = isAzure
    ? Azure.ImagePath(modelConfig.model, accessStore.azureApiVersion)
    : OpenaiPath.ImagePath;
  return cloudflareAIGatewayUrl([baseUrl, path].join("/"));
}

export async function sendImageRequest(options: ChatOptions) {
  const modelConfig = {
    ...useAppConfig.getState().modelConfig,
    ...options.config,
  };
  const prompt = getMessageTextContent(options.messages.slice(-1)?.pop() as any);
  const requestPayload: DalleRequestPayload = {
    model: options.config.model,
    prompt,
    response_format: "b64_json",
    n: 1,
    size: options.config?.size ?? "1024x1024",
    quality: options.config?.quality ?? "standard",
    style: options.config?.style ?? "vivid",
  };

  const headers = await getHeaders();
  const controller = new AbortController();
  options.onController?.(controller as any);

  try {
    const chatPath = buildPathFromConfig(modelConfig, modelConfig.providerName === ServiceProvider.Azure);
    const chatPayload = {
      method: "POST",
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
      headers,
    } as any;

    const requestTimeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(chatPath, chatPayload);
    clearTimeout(requestTimeoutId);
    const resJson = await res.json();
    const message = await extractImageMessage(resJson);
    options.onFinish(message, res);
  } catch (e) {
    console.log("[Request] failed to make a image request", e);
    options.onError?.(e as Error);
  }
}

export { OpenaiPath };
