import { generateText } from "ai";
import { z } from "zod";
import { mainModel, mainModelId } from "@/lib/llm";
import { prisma } from "@/lib/db";
import {
  buildInterviewerSystemPrompt,
  extractDimension,
  type Tier,
} from "@/lib/prompts/interviewer";
import { recordUsage } from "@/lib/usage";

// targetTier 在 UI 上已下线,但 DB 列仍存在(默认 top5)。保留 zod 兜底
// 是为了 backward compat — 任何老 client 还能跑通。
const Body = z.object({
  experience: z.string().min(20, "经历至少 20 字").max(8000),
  field: z.string().min(1).max(60),
  targetTier: z.enum(["top5", "top10", "211"]).default("top5"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { experience, field, targetTier } = parsed.data;

  const session = await prisma.session.create({
    data: { experience, field, targetTier },
  });

  const model = mainModelId();
  try {
    const { text, usage } = await generateText({
      model: mainModel(),
      system: buildInterviewerSystemPrompt({
        field,
        experience,
        targetTier: targetTier as Tier,
        turnIndex: 0,
      }),
      prompt: "开始本场面试,问出你的第一个问题。",
      temperature: 0.7,
    });
    await recordUsage({
      endpoint: "session_open",
      model,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      sessionId: session.id,
    });
    const { dimension, cleanContent } = extractDimension(text);
    await prisma.turn.create({
      data: {
        sessionId: session.id,
        role: "interviewer",
        content: cleanContent,
        dimension,
      },
    });
  } catch (err) {
    await recordUsage({
      endpoint: "session_open",
      model,
      promptTokens: 0,
      completionTokens: 0,
      sessionId: session.id,
      ok: false,
      errorMessage: (err as Error).message,
    });
    await prisma.turn.create({
      data: {
        sessionId: session.id,
        role: "interviewer",
        content: `[开场生成失败:${(err as Error).message}] 请直接讲一下你这段科研经历的整体情况。`,
        dimension: "motivation",
      },
    });
  }

  return Response.json({ sessionId: session.id });
}
