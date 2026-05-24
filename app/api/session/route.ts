import { generateText } from "ai";
import { z } from "zod";
import { mainModel, mainModelId } from "@/lib/llm";
import { prisma } from "@/lib/db";
import {
  buildInterviewerSystemPrompt,
  extractDimension,
} from "@/lib/prompts/interviewer";
import { recordUsage } from "@/lib/usage";
import { summarizeMaterials, type LabeledImage } from "@/lib/vision";

// 验证规则: 必须 至少一个 {experience 文本 >=20 字, resumeImages 至少 1 页}
// PPT 完全可选。
// 服务端兜底校验, 防止有人绕过前端直接 POST。
const ImagePage = z.object({
  dataUrl: z.string().startsWith("data:image/"),
});

const Body = z
  .object({
    experience: z.string().max(8000).optional(),
    field: z.string().min(1).max(60),
    targetTier: z.enum(["top5", "top10", "211"]).default("top5"),
    // 向后兼容: 旧 client 传 `images` 字段
    images: z.array(ImagePage).max(5).optional(),
    resumeImages: z.array(ImagePage).max(5).optional(),
    pptImages: z.array(ImagePage).max(20).optional(),
    // 用户主动指定的"本场重点挖的薄弱点"
    // (项目级别 e.g. "baseline 弱" 或 宏观认知 e.g. "对 LLM 训练范式不熟")
    // 兼容 string(老调用) 和 string[](新多选 UI)
    weaknessFocus: z.string().min(1).max(500).optional(),
    weaknessFocuses: z.array(z.string().min(1).max(500)).max(10).optional(),
  })
  .refine(
    (data) => {
      const hasText = (data.experience?.trim().length ?? 0) >= 20;
      const hasResume =
        (data.resumeImages?.length ?? 0) > 0 ||
        (data.images?.length ?? 0) > 0;
      return hasText || hasResume;
    },
    {
      message: "请至少提供一段科研经历正文(20 字以上)或上传简历 PDF",
      path: ["experience"],
    },
  );

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_body",
        message: parsed.error.issues[0]?.message ?? "请求格式错误",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }
  const {
    experience,
    field,
    targetTier,
    resumeImages,
    pptImages,
    images,
    weaknessFocus,
    weaknessFocuses,
  } = parsed.data;
  // 归一化: 老 UI 传 weaknessFocus, 新 UI 传 weaknessFocuses, 合并去重
  const allFocuses = [
    ...(weaknessFocus ? [weaknessFocus] : []),
    ...(weaknessFocuses ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const dedupedFocuses = Array.from(new Set(allFocuses));

  // 1) 先创建会话, 占位 experience 用空字符串(后续可能被材料摘要替换/补充)
  const initialExperience = experience?.trim() ?? "";
  const session = await prisma.session.create({
    data: {
      experience:
        initialExperience.length >= 20
          ? initialExperience
          : "[暂无文字经历, 等待材料摘要]",
      field,
      targetTier,
    },
  });

  // 2) 如果有任何图片材料(简历/PPT/兼容 images), 调 vision 合并摘要
  // 兼容: 旧 client 传 images, 视为简历
  const labeledImages: LabeledImage[] = [];
  const resumeList = resumeImages ?? images ?? [];
  resumeList.forEach((img, i) => {
    labeledImages.push({
      dataUrl: img.dataUrl,
      pageNumber: i + 1,
      kind: "resume",
    });
  });
  (pptImages ?? []).forEach((img, i) => {
    labeledImages.push({
      dataUrl: img.dataUrl,
      pageNumber: i + 1,
      kind: "ppt",
    });
  });

  let effectiveExperience = initialExperience;
  if (labeledImages.length > 0) {
    try {
      const { summary } = await summarizeMaterials({
        images: labeledImages,
        field,
        experienceHint: initialExperience || undefined,
        sessionId: session.id,
      });
      if (summary) {
        const header = initialExperience
          ? `${initialExperience}\n\n【候选人上传的材料 AI 摘要】\n${summary}`
          : `【候选人未填写文字经历,以下为上传材料的 AI 摘要】\n${summary}`;
        effectiveExperience = header;
        await prisma.session.update({
          where: { id: session.id },
          data: { experience: effectiveExperience },
        });
      }
    } catch (err) {
      console.error("vision summarization failed:", err);
      // 视觉失败但有文字: 继续走文字流程
      // 视觉失败且无文字: experience 会是占位串, 面试官会被迫开场问 "请先讲讲你做了什么"
    }
  }

  // 3) 生成开场问题
  const model = mainModelId();
  try {
    const { text, usage } = await generateText({
      model: mainModel(),
      system: buildInterviewerSystemPrompt({
        field,
        experience: effectiveExperience,
        turnIndex: 0,
        weaknessFocuses: dedupedFocuses,
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
