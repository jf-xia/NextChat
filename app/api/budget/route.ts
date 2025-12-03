import { NextRequest, NextResponse } from "next/server";
import { auth, getLLMKey } from "../auth";
import { ModelProvider } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";

const LITELLM_BASE_URL = process.env.BASE_URL ?? "";

async function handle(req: NextRequest) {
  const authResult = await auth(req, ModelProvider.GPT);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  const authValue = req.headers.get("Authorization") ?? "";

  try {
    let response = await getLLMKey(authValue.replace("Bearer ", "").trim());
    return NextResponse.json(response);
  } catch (e) {
    console.error("[Budget] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
