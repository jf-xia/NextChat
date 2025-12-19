import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, OPENAI_BASE_URL, OpenaiPath } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

const ALLOWED_PATH = new Set([OpenaiPath.ImageEditPath]);
const serverConfig = getServerSideConfig();

export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[OpenAI Image Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWED_PATH.has(subpath)) {
    console.log("[OpenAI Image Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = await auth(req, ModelProvider.GPT);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const controller = new AbortController();
  
    var spend = req.headers.get("spend") ?? "";
    var budget = req.headers.get("budget") ?? "";
  
    var authValue,
      authHeaderName = "";
      authValue = req.headers.get("Authorization") ?? "";
      authHeaderName = "Authorization";
      
    let path = `${req.nextUrl.pathname}`.replaceAll("/api/openaiimages/", "");
  
    let baseUrl = serverConfig.baseUrl || OPENAI_BASE_URL;
  
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
  
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
  
    console.log("[Proxy] ", path);
    console.log("[Base Url]", baseUrl);
  
    const timeoutId = setTimeout(
      () => {
        controller.abort();
      },
      10 * 60 * 1000,
    );
  
    const fetchUrl = `${baseUrl}/${path}`;
    
    const requestPayload = await req.json();
    const formData = new FormData();  
    formData.append("model", requestPayload.model);
    formData.append("prompt", requestPayload.prompt);
    formData.append("n", requestPayload.n.toString());
    formData.append("output_format", requestPayload.output_format);
    formData.append("size", requestPayload.size);
    formData.append("quality", requestPayload.quality);
    
    // Convert base64 -> binary in a way that works in Node (Buffer) and fall back to browser APIs.
    const base64Str = (requestPayload.image || "").split(",").pop() || "";
    const mimeMatch = (requestPayload.image || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const filename = "image.jpg";

    try {
      // Prefer Node Buffer when available (server-side). Buffer.from handles base64 reliably.
      // @ts-ignore Buffer may not be defined in browser runtimes
      if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        // @ts-ignore
        const buffer = Buffer.from(base64Str, "base64");
        const blob = new Blob([buffer], { type: mimeType });
        // Some FormData implementations (Node/undici) accept a filename as a third arg.
        // @ts-ignore allow appending blob with filename
        formData.append("image", blob, filename);
      } else {
        // Browser fallback: use atob + File
        const byteString = atob(base64Str);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        const file = new File([blob], filename, { type: mimeType });
        formData.append("image", file);
      }
    } catch (err) {
      console.error("[OpenAI Image] image conversion error:", err);
      // Fallback: append base64 string directly (some APIs accept data URLs)
      formData.append("image", requestPayload.image);
    }
    console.log("[Request] openai image reqJson: ", requestPayload);
    const fetchOptions: RequestInit = {
      headers: {
        // "Cache-Control": "no-store",
        // 'Content-Type': "multipart/form-data",
        [authHeaderName]: authValue,
      },
      method: "POST",
      body: formData,
      // @ts-ignore
      duplex: "half",
    };
    console.log("[Fetch Url & fetchOptions]", fetchUrl, fetchOptions);
    try {
      const res = await fetch(fetchUrl, fetchOptions);
      console.log("[OpenAI Image Response] ", res.status, res.statusText);
      const newHeaders = new Headers(res.headers);
      newHeaders.delete("www-authenticate");
      newHeaders.set("X-Accel-Buffering", "no");
      newHeaders.set("spend", spend);
      newHeaders.set("budget", budget);
      newHeaders.delete("content-encoding");

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.error("[OpenAI] ", e);
    return NextResponse.json(prettyObject(e));
  }
}
