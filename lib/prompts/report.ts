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
 *     modelAnswers: [                // 针对面试中实际问到的问题,给出示范回答
 *       { question, yourIssue, modelAnswer }  // modelAnswer 300-500 字
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
  "modelAnswers": [
    { "question": string, "yourIssue": string, "modelAnswer": string }
  ],
  "redFlags": [string, ...]
}

【硬性要求】
- weaknesses 按严重度降序排,最多 6 条
- modelAnswers:从面试官**实际问过的问题**里挑 2-3 个最有教学价值的(候选人答得最差、或在真实复试里被问到概率最高),给出示范回答。
  - question: 面试官那条原问题的简洁复述,去掉寒暄和过渡词,不要超过 50 字
  - yourIssue: 一句话点明候选人那条回答的具体问题(如"只说做了 X,没说为什么选 X 而不是 Y"/"数据指标空泛,没给基线对比")
  - modelAnswer: **必须 300-500 字之间(下限 300,不要少于 300!少于 300 字算不合格)**,严格遵守:
    · 必须用第一人称("我")、口语化,像候选人本人在答辩现场说出来的样子(口语 1.5-2 分钟体量)
    · 必须基于候选人在本次面试 + 经历原文里提到的真实信息,**绝对不要编造数据/论文/导师名/baseline 名字**
    · 当候选人原回答缺失关键信息时,用"如果……我会答……"的占位表达,如"如果当时具体数字是 X%(请按真实情况替换),那我会说……"
    · 体现完整的口语化答题结构(铺垫动机/背景 → 具体做法或关键决策 → 结果或反思),避免硬列点
    · 不要为了凑字数注水;若内容已足,可以多展开一层(如多说一个对比方案、多说一句反思的具体动作),把回答撑到 300-500 字这个真实复试体量
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
  modelAnswers: { question: string; yourIssue: string; modelAnswer: string }[];
  redFlags: string[];
};
