import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getUsernameByToken } from "../auth";
import { prismaMysql } from "@/lib/prisma-mysql";

export const runtime = "nodejs";

type SessionType = Prisma.AiSessionGetPayload<{
  select: {
    id: true;
    topic: true;
    memoryPrompt: true;
    messages: true;
    tokenCount: true;
    wordCount: true;
    charCount: true;
    lastUpdate: true;
    lastSummarizeIndex: true;
    clearContextIndex: true;
  };
}>;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.trim().replace("Bearer ", "").trim();

    const email = token ? await getUsernameByToken(token) : null;
    if (!email) {
      return NextResponse.json(
        { error: true, msg: "forbidden" },
        { status: 403 },
      );
    }

    const sessions = await prismaMysql.aiSession.findMany({
      where: {
        deletedAt: null,
        user: { email },
      },
      orderBy: [{ lastUpdate: "desc" }],
      take: 20,
      select: {
        id: true,
        topic: true,
        memoryPrompt: true,
        messages: true,
        tokenCount: true,
        wordCount: true,
        charCount: true,
        lastUpdate: true,
        lastSummarizeIndex: true,
        clearContextIndex: true,
      },
    });

    return NextResponse.json(
      sessions.map((s: SessionType) => ({
        id: s.id.toString(),
        topic: s.topic,
        memoryPrompt: s.memoryPrompt,
        messages: s.messages,
        tokenCount: s.tokenCount,
        wordCount: s.wordCount,
        charCount: s.charCount,
        lastUpdate: s.lastUpdate,
        lastSummarizeIndex: s.lastSummarizeIndex,
        clearContextIndex: s.clearContextIndex,
      })),
    );
  } catch (e) {
    console.error("[MySQL Sessions] ", e);
    return NextResponse.json(
      { error: true, msg: "internal error" },
      { status: 500 },
    );
  }
}
