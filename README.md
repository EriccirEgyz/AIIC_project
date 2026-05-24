# AI 保研深挖 · 顶会式科研经历追问

> 北大 AIIC 16 小时项目挑战 · 2026-05-24
>
> **目标用户**：想保研到**人工智能方向**的本科生（CV / NLP / 大模型 / 多模态 / 生成
> / RL / 推荐 / 理论 / 模型效率 等）。**不**面向其他工科/理科/文科 —— 这是产品策略
> 上的"做窄做深"，详见下文。
>
> **做什么**：像 AI 顶会审稿人 + 985 导师一样，按「动机 / 方法 / 数据 / 困难 / 反思」
> 五维度连续追问你的一段科研经历 5-10 轮，结束后输出一份**可执行**的反馈报告
> （薄弱点 + 红旗 + 可背的示范答法）。

## 为什么"窄"到只服务 AI 方向？

题目原文里有一句话："建议在用户群上做取舍，不要做得太泛。我们鼓励你做深做窄。"

AI 方向的特殊性让窄定位成立：

- **真实评审 norms 高度统一**：ablation / baseline / 统计显著性 / 复现性 / 数据泄漏，
  这套话语体系在 NeurIPS / CVPR / ACL 是通用的。
- **顶会审稿人的"挖坑"模式可被 prompt 化**：见 [lib/prompts/interviewer.ts](lib/prompts/interviewer.ts)
  里的"AI/ML 领域追问弹药库" —— 8 个子方向各有高频追问主题。
- **本科生项目分布集中**：2026 年 AI 本科生的科研基本落在 8 个篮子里，prompt
  能精准命中；其他领域（生物 / 物理 / 化学）分布太散，AI 当 generalist 反而做不深。

## 为什么它比直接用 ChatGPT 强

| | ChatGPT 直接问 | 本项目 |
|---|---|---|
| 追问框架 | 想到哪问到哪 | 五维度循环 + 阶段策略（前 2 轮温和，3 轮起转批判） |
| 领域知识 | 通用 | 内置 AI 领域 8 子方向的高频追问弹药 + 红旗信号 |
| 追问粒度 | 容易抽象 | 强制引用你原文细节（"你刚才提到的 ResNet-50..."） |
| 反馈形式 | 鼓励式总结 | 严格 0-10 评分 + 致命红旗 + **可直接背的示范答法** |
| 持久化 | 一关窗口就没 | SQLite 存所有会话，可复盘 |
| 成本透明 | 看不到 | `/api/usage` 实时显示每次调用的 token + 估算花销 |

## 用户路径

1. 首页选 AI 子方向（8 个预设 + "其他自定义"）+ 目标院校层次（Top5 / Top10 / 211 决定追问犀利度）
2. 粘贴一段 200-500 字科研经历（或点"AI 帮我生成脱敏样例"）
3. 跳到面试页，AI 用顶会审稿口吻连续追问 5-10 轮，每轮带维度色标
4. 点"结束 · 看报告"，得到结构化反馈

## 技术栈

- **Next.js 16** (App Router, TS, Turbopack) + Tailwind v4 + React 19
- **Vercel AI SDK 6** (`streamText` / `generateObject` / `useChat`)
- **Prisma 7** + **better-sqlite3** (本地文件即数据库，零运维)
- **LLM**：OpenRouter → Qwen Plus 2025-07-28（Alibaba 原生托管，1M 上下文，
  $0.26/$0.78 per MTok，中文学术对话强）
- LLM 调用全程 usage tracking → `/api/usage`

## 快速开始

```bash
# 1. 装依赖（postinstall 会自动跑 prisma generate）
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填 OPENROUTER_API_KEY

# 3. 初始化数据库
npm run db:migrate

# 4. 启动
npm run dev
# 打开 http://localhost:3000
```

## 切换 LLM 模型

`.env.local` 改一行就够，无需改代码：

```bash
OPENROUTER_MAIN_MODEL="qwen/qwen-plus-2025-07-28"   # 默认,推荐
# 备选:
# OPENROUTER_MAIN_MODEL="deepseek/deepseek-v3.2"
# OPENROUTER_MAIN_MODEL="mistralai/mistral-small-3.2-24b-instruct"  # 最便宜
```

国内服务器调 OpenAI 系列模型时需要 `OPENROUTER_PROVIDER_ORDER="Azure"` 绕过 region block，
详见 [lib/llm.ts](lib/llm.ts) 注释。

## 目录结构

```
app/
  page.tsx                    首页:选方向 + 输入经历
  interview/[id]/page.tsx     聊天页(流式 SSE)
  report/[id]/page.tsx        反馈报告页
  api/
    sample/route.ts           生成脱敏样例(lite model)
    session/route.ts          创建会话 + 生成开场问题
    chat/route.ts             多轮追问流式接口
    report/route.ts           generateObject 输出 JSON 报告
    usage/route.ts            查询累计 token + cost
  generated/prisma/           Prisma Client(gitignore)
lib/
  db.ts                       Prisma + better-sqlite3 adapter
  llm.ts                      provider-agnostic LLM 客户端 + CN routing
  usage.ts                    pricing 表 + recordUsage
  prompts/
    interviewer.ts            五维度 + 8 子方向追问弹药库(差异化核心)
    report.ts                 评分锚点 + JSON schema
    sample.ts                 AI 方向样例生成
components/
  ExperienceForm.tsx
  InterviewChat.tsx
  ReportView.tsx
prisma/
  schema.prisma               Session / Turn / Report / UsageLog
```

## 部署到云服务器（pm2）

```bash
# 在服务器上
git pull
npm ci
npm run db:deploy       # 应用迁移
npm run build
pm2 start npm --name aiic -- start
# 前面挂 Caddy / Nginx 反向代理 + HTTPS
```

## AI 工具使用说明（评分必交项）

- **Claude Code (Opus 4.7)** 用于全部代码 + prompt 撰写 + README + 调试
- **Qwen Plus 2025-07-28 via OpenRouter** 作为运行时面试官 + 报告生成
  - 选它而非 Claude 是因为 OpenRouter shared key 在 CN 区拿不到 Anthropic 模型
  - Alibaba 原生中文 + 8K-32K-长上下文场景表现稳

## License

MIT — see [LICENSE](LICENSE).
