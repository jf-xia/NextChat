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
import {
  ChatOptions,
  getHeaders,
  LLMApi,
  SpeechOptions,
  LLMUsage,
  LLMModel,
} from "../api";
import { getMessageTextContent, isImageModel, isOpenAIImageModel as _isOpenAIImageModel } from "@/app/utils";
import { fetch } from "@/app/utils/stream";
import { getClientConfig } from "@/app/config/client";
import { openAIImageModels } from "@/app/constant";

export interface ImageRequestPayload {
  model: string;
  prompt: string;
  output_format: "png";
  n: number;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "low" | "medium" | "high";
}


export class OpenaiImageApi implements LLMApi {
  path(path: string): string {
    const accessStore = useAccessStore.getState();
    let baseUrl = "";
    const isAzure = path.includes("deployments");
    if (accessStore.useCustomConfig) {
      if (isAzure && !accessStore.isValidAzure()) {
        throw Error(
          "incomplete azure config, please check it in your settings page",
        );
      }
      baseUrl = isAzure ? accessStore.azureUrl : accessStore.openaiUrl;
    }
    if (baseUrl.length === 0) {
      const isApp = !!getClientConfig()?.isApp;
      const apiPath = isAzure ? ApiPath.Azure : ApiPath.OpenAI;
      baseUrl = isApp ? OPENAI_BASE_URL : apiPath;
    }
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    if (!baseUrl.startsWith("http") && !isAzure && !baseUrl.startsWith(ApiPath.OpenAI)) {
      baseUrl = "https://" + baseUrl;
    }

    return cloudflareAIGatewayUrl([baseUrl, path].join("/"));
  }
  async speech(options: SpeechOptions): Promise<ArrayBuffer> {
    const requestPayload = {
      model: options.model,
      input: options.input,
      voice: options.voice,
      response_format: options.response_format,
      speed: options.speed,
    };

    console.log("[Request] openai speech payload: ", requestPayload);

    const controller = new AbortController();
    options.onController?.(controller);
    try {
      const headers = await getHeaders();
      const speechPath = buildPathFromConfig({ model: options.model }, false);
      const speechPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers,
      };

      const requestTimeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(speechPath, speechPayload);
      clearTimeout(requestTimeoutId);
      return await res.arrayBuffer();
    } catch (e) {
      console.log("[Request] failed to make a speech request", e);
      throw e;
    }
  }

  async chat(options: ChatOptions) {
    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...options.config,
    };

    // only handle openai image models
    if (!_isOpenAIImageModel(modelConfig.model)) {
      throw new Error("model is not a valid openai image model");
    }

    const prompt = getMessageTextContent(options.messages.slice(-1)?.pop() as any);

    let requestPayload: ImageRequestPayload = {
      model: modelConfig.model,
      prompt,
      output_format: "png",
      n: 1,
      size: (options.config as any)?.size ?? "1024x1024",
      quality: (options.config as any)?.quality ?? "low",
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

  async usage(): Promise<LLMUsage> {
    // reuse OpenAI usage API
    const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = `${startOfMonth.getFullYear()}-${(startOfMonth.getMonth() + 1).toString().padStart(2, "0")}-${startOfMonth
      .getDate()
      .toString()
      .padStart(2, "0")}`;
    const endDate = `${new Date(Date.now() + ONE_DAY).getFullYear()}-${(
      new Date(Date.now() + ONE_DAY).getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${new Date(Date.now() + ONE_DAY)
      .getDate()
      .toString()
      .padStart(2, "0")}`;
    const headers = await getHeaders();

    const [used, subs] = await Promise.all([
      fetch(this.path(OpenaiPath.UsagePath + `?start_date=${startDate}&end_date=${endDate}`), {
        method: "GET",
        headers,
      }),
      fetch(this.path(OpenaiPath.SubsPath), {
        method: "GET",
        headers,
      }),
    ]);

    if (used.status === 401) {
      throw new Error("Unauthorized");
    }
    if (!used.ok || !subs.ok) {
      throw new Error("Failed to query usage from openai");
    }

    const response = (await used.json()) as {
      total_usage?: number;
      error?: {
        type: string;
        message: string;
      };
    };
    const total = (await subs.json()) as {
      hard_limit_usd?: number;
    };
    if (response.error && response.error.type) {
      throw Error(response.error.message);
    }
    if (response.total_usage) {
      response.total_usage = Math.round(response.total_usage) / 100;
    }
    if (total.hard_limit_usd) {
      total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
    }
    return {
      used: response.total_usage,
      total: total.hard_limit_usd,
    } as LLMUsage;
  }

  async models(): Promise<LLMModel[]> {
    let seq = 1000;
    return openAIImageModels.map((name) => ({
      name,
      available: true,
      sorted: seq++,
      provider: {
        id: "openaiimages",
        providerName: "HSUHK AzureAI Image",
        providerType: "openaiimages",
        sorted: 1,
      },
    } as LLMModel));
  }
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
  const requestPayload: ImageRequestPayload = {
      model: modelConfig.model,
      prompt,
      output_format: "png",
      n: 1,
      size: (options.config as any)?.size ?? "1024x1024",
      quality: (options.config as any)?.quality ?? "low",
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
