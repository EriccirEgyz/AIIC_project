/**
 * 反馈报告生成器 prompt。
 *
 * 输入:整段面试对话 + 候选人原始经历
 * 输出:严格 JSON
 *   {
 *     scores: { motivation, method, data, failure, reflection } 0-10,
 *     overall: 0-10,
 *     strengths: [string],
 *     weaknesses: [string],          // 最致命的薄弱点,按严重度排序
 *     improvements: [                // 可执行改进
 *       { issue, suggestion, exampleAnswer }
 *     ],
 *     redFlags: [string]             // 真实复试中可能直接被刷的硬伤
 *   }
 *
 * 评分锚点(避免 LLM 给好好先生分数):
 *   10 = 顶尖会议一作水平的真实科研
 *    8 = 已有完整结果,逻辑自洽,经得起追问
 *    6 = 想法清楚但细节模糊或有漏洞
 *    4 = 像是参与了别人的项目,自己只懂表层
 *    2 = 显然没真做过 / 严重夸大
 */

export const REPORT_SYSTEM_PROMPT = `你是一位保研复试评估专家,刚刚旁观了一场科研经历追问面试。

请基于"面试官提问 + 候选人回答"的全过程,产出一份严格 JSON 反馈报告。不要写任何 JSON 之外的文字,不要 markdown 代码块包裹。

【评分锚点 - 严格用,不要好好先生分】
10 = 顶尖会议一作水平的真实科研
 8 = 已有完整结果、逻辑自洽,经得起追问
 6 = 想法清楚但细节模糊或有漏洞
 4 = 像是参与了别人的项目,自己只懂表层
 2 = 显然没真做过 / 严重夸大

【五个维度】
motivation(动机) / method(方法) / data(数据与结果) / failure(困难与失败) / reflection(反思与展望)

【输出 schema】
{
  "scores": {
    "motivation": number, "method": number, "data": number,
    "failure": number, "reflection": number
  },
  "overall": number,
  "strengths": [string, ...],
  "weaknesses": [string, ...],
  "improvements": [
    { "issue": string, "suggestion": string, "exampleAnswer": string }
  ],
  "redFlags": [string, ...]
}

【硬性要求】
- weaknesses 按严重度降序排,最多 4 条
- improvements 每条必须有 exampleAnswer(一段示范回答,40-80 字,可以直接背)
- redFlags 只列真实导师会因此直接 pass 的硬伤(数据造假迹象、连本科课程都讲不清的概念、回答自相矛盾等),没有就给 []
- 全部中文,语气直接,不要客套`;

export function buildReportUserPrompt(opts: {
  experience: string;
  transcript: { role: string; content: string; dimension?: string | null }[];
}) {
  const transcriptText = opts.transcript
    .map(
      (t, i) =>
        `--- 第 ${i + 1} 条 [${t.role === "interviewer" ? "面试官" : "候选人"}${t.dimension ? `·${t.dimension}` : ""}] ---\n${t.content}`,
    )
    .join("\n\n");

  return `【候选人提交的科研经历原文】
"""
${opts.experience}
"""

【完整面试对话记录】
${transcriptText}

请输出 JSON 反馈报告。`;
}

export type ReportJson = {
  scores: {
    motivation: number;
    method: number;
    data: number;
    failure: number;
    reflection: number;
  };
  overall: number;
  strengths: string[];
  weaknesses: string[];
  improvements: { issue: string; suggestion: string; exampleAnswer: string }[];
  redFlags: string[];
};
