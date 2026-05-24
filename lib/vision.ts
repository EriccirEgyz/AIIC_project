/**
 * 视觉调用 — 用 qwen/qwen3.6-plus 总结候选人上传的简历/PPT 图片。
 *
 * 策略: 创建会话时调一次 vision 把图片"翻译"成结构化文字摘要,
 * 然后合并进 experience 字段。后续 chat / report 调用都用纯文本模型,
 * 节约 token. 这是相对"每轮带图"路线的成本控制取舍。
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { recordUsage } from "@/lib/usage";

const VISION_MODEL = "qwen/qwen3.6-plus";

function buildClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://github.com/EriccirEgyz/AIIC_project",
      "X-Title": "AIIC Mock Interview",
    },
  });
}

export type ResumeImage = {
  /** data:image/png;base64,... format (or any image data URL) */
  dataUrl: string;
};

export type SummarizeResult = {
  summary: string;
  tokensIn: number;
  tokensOut: number;
};

/**
 * 把候选人上传的简历/PPT 图片(已是 PNG)送给 vision 模型,返回结构化的中文文字摘要。
 * 摘要应该足够细致,让后续纯文本的面试官能基于此追问细节。
 */
export async function summarizeResumeImages(opts: {
  images: ResumeImage[];
  field: string;
  experienceHint?: string;
  sessionId?: string;
}): Promise<SummarizeResult> {
  if (opts.images.length === 0) {
    return { summary: "", tokensIn: 0, tokensOut: 0 };
  }
  const client = buildClient();
  const model = client.chat(VISION_MODEL);

  const systemPrompt = `你是一位 AI 方向的研究生导师助理。候选人上传了简历或科研经历的 PPT/PDF 截图(${opts.images.length} 页)。请你像导师快速翻阅材料那样,产出一段结构化文字摘要,供后续追问环节参考。

【硬性要求】
- 全部中文输出
- 重点提取: 项目名 / 用到的模型或方法名 / 数据集 / 关键数字结果 / 可视化图表的内容(如"第 2 页有一张 attention 模块结构图,包含 Q/K/V 三个分支") / 候选人的个人贡献描述
- 对每页用一段(或几行)概述,标明"第 X 页:"
- 看到的图表/示意图要描述清楚,因为后续追问的导师看不到图,只能靠你的描述
- 如果某页是常规简历(教育经历、奖项),简短列出即可
- 看不清的细节就如实说"看不清",不要瞎编`;

  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [];
  for (const [i, img] of opts.images.entries()) {
    userParts.push({ type: "text", text: `--- 第 ${i + 1} 页 ---` });
    userParts.push({ type: "image", image: img.dataUrl });
  }
  userParts.push({
    type: "text",
    text: `候选人申请的导师方向: ${opts.field}${
      opts.experienceHint ? `\n候选人自己写的经历摘要(供参考): ${opts.experienceHint.slice(0, 300)}` : ""
    }\n\n请按上述要求产出材料摘要。`,
  });

  const { text, usage } = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: "user", content: userParts }],
    temperature: 0.3,
  });

  const tokensIn = usage.inputTokens ?? 0;
  const tokensOut = usage.outputTokens ?? 0;

  await recordUsage({
    endpoint: "session_open",
    model: VISION_MODEL,
    promptTokens: tokensIn,
    completionTokens: tokensOut,
    sessionId: opts.sessionId,
  });

  return { summary: text.trim(), tokensIn, tokensOut };
}
