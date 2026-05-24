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
import { summarizeResumeImages } from "@/lib/vision";

// targetTier 在 UI 上已下线,但 DB 列仍存在(默认 top5)。保留 zod 兜底
// 是为了 backward compat — 任何老 client 还能跑通。
//
// images: optional, 客户端 pdfjs-dist 渲染好的简历/PPT 页面 PNG (data URL).
// 限制 5 页防止 vision 调用超载。
const Body = z.object({
  experience: z.string().min(20, "经历至少 20 字").max(8000),
  field: z.string().min(1).max(60),
  targetTier: z.enum(["top5", "top10", "211"]).default("top5"),
  images: z
    .array(z.object({ dataUrl: z.string().startsWith("data:image/") }))
    .max(5)
    .optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { experience, field, targetTier, images } = parsed.data;

  // 1) 先创建会话(占位,得到 sessionId)
  const session = await prisma.session.create({
    data: { experience, field, targetTier },
  });

  // 2) 如果上传了简历图片,先把图片摘要成文字,合并进 experience
  let effectiveExperience = experience;
  if (images && images.length > 0) {
    try {
      const { summary } = await summarizeResumeImages({
        images,
        field,
        experienceHint: experience,
        sessionId: session.id,
      });
      if (summary) {
        effectiveExperience = `${experience}\n\n【候选人上传的简历/PPT 内容摘要 (${images.length} 页)】\n${summary}`;
        // 持久化到 experience,后续 chat / report 自动拿到
        await prisma.session.update({
          where: { id: session.id },
          data: { experience: effectiveExperience },
        });
      }
    } catch (err) {
      // 视觉调用失败不应阻塞面试,记一个 turn 提示一下即可
      console.error("vision summarization failed:", err);
    }
  }

  // 3) 生成开场问题(纯文本,使用合并后的 experience)
  const model = mainModelId();
  try {
    const { text, usage } = await generateText({
      model: mainModel(),
      system: buildInterviewerSystemPrompt({
        field,
        experience: effectiveExperience,
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
