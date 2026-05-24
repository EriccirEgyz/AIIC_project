/**
 * 视觉调用 — 用 qwen/qwen3.6-plus 总结候选人上传的简历和 PPT 图片。
 *
 * 策略: 创建会话时调一次 vision 把所有图片"翻译"成结构化文字摘要,
 * 然后合并进 experience 字段。后续 chat / report 调用都用纯文本模型,
 * 节约 token. 这是相对"每轮带图"路线的成本控制取舍。
 *
 * 简历 vs PPT 分类: 单次 vision call 内用 "[简历 第 N 页]" / "[PPT 第 M 页]"
 * 标签区分,prompt 给出各自的提取重点(简历看背景/经历列表,PPT 看项目深度/图表)。
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

export type LabeledImage = {
  /** data:image/png;base64,... */
  dataUrl: string;
  /** 1-based page number within its kind */
  pageNumber: number;
  /** what the page belongs to */
  kind: "resume" | "ppt";
};

export type SummarizeResult = {
  summary: string;
  tokensIn: number;
  tokensOut: number;
};

/**
 * 把候选人上传的简历 + PPT 图片送给 vision 模型,返回结构化中文摘要。
 * 简历重点提背景/经历列表; PPT 重点提项目细节、实验数据、图表内容。
 */
export async function summarizeMaterials(opts: {
  images: LabeledImage[];
  field: string;
  experienceHint?: string;
  sessionId?: string;
}): Promise<SummarizeResult> {
  if (opts.images.length === 0) {
    return { summary: "", tokensIn: 0, tokensOut: 0 };
  }
  const client = buildClient();
  const model = client.chat(VISION_MODEL);

  // 计数每类页数,用于 prompt 顶部
  const resumePages = opts.images.filter((i) => i.kind === "resume").length;
  const pptPages = opts.images.filter((i) => i.kind === "ppt").length;

  const materialsDesc: string[] = [];
  if (resumePages > 0) materialsDesc.push(`简历 ${resumePages} 页`);
  if (pptPages > 0) materialsDesc.push(`科研 PPT ${pptPages} 页`);

  const systemPrompt = `你是一位 AI 方向的研究生导师助理。候选人上传了 ${materialsDesc.join(" + ")} 准备保研复试。请你像导师快速翻阅材料那样产出结构化中文摘要,供后续追问环节参考(下游的追问环节是纯文本,看不到图,只能靠你的描述)。

【对【简历】部分(标签为"[简历 第 N 页]"的图)】
重点提取:
- 教育背景(本科学校层次、专业、GPA/排名 若可见)
- 项目/科研经历列表(每条:课题名 / 角色 / 时间 / 一句话成果)
- 实习经历
- 获奖、技能、论文、专利

【对【PPT】部分(标签为"[PPT 第 N 页]"的图)】
重点提取(逐页摘要,加"PPT 第 N 页:"前缀):
- 项目动机 / 背景 / 已有工作不足
- 用的方法、模型名、技术栈
- 实验设置: 数据集 / baseline / 评估指标
- 关键数字结果(必须保留原数,如"PSNR 提升 0.32dB")
- 看到的图表/示意图要描述清楚(如"第 5 页有一张 attention 模块结构图,包含 Q/K/V 三个分支")
- 候选人的个人贡献描述(如"我负责..."、"我的工作")

【硬性要求】
- 全部中文
- 看不清的细节就如实说"看不清",不要瞎编
- 保留所有具体数字、模型名、数据集名(后续追问会引用)
- 输出结构:先一段简历摘要,再 PPT 逐页摘要`;

  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [];

  for (const img of opts.images) {
    const tag =
      img.kind === "resume"
        ? `[简历 第 ${img.pageNumber} 页]`
        : `[PPT 第 ${img.pageNumber} 页]`;
    userParts.push({ type: "text", text: tag });
    userParts.push({ type: "image", image: img.dataUrl });
  }

  userParts.push({
    type: "text",
    text: `候选人申请的导师方向: ${opts.field}${
      opts.experienceHint
        ? `\n候选人自己写的经历摘要(供参考,可能为空): ${opts.experienceHint.slice(0, 400)}`
        : ""
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
