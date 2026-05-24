# AI 保研深挖 · 顶会式科研经历追问

> 北大 AIIC 16 小时项目挑战 · 2026-05-24
>
> **目标用户**：想保研到**人工智能方向**的本科生（大模型 / Agent / RLHF · CV ·
> NLP · 多模态 · 生成模型 · RL · 推荐 · 模型效率 · 机器学习理论 等 8 个子方向 +
> 自定义兜底）。**不**面向其他工科/理科/文科 —— 这是产品策略上的「做窄做深」。
>
> **做什么**：像 AI 顶会审稿人 + 985 导师一样按「动机 / 方法 / 数据 / 困难 / 反思」
> 五维度连续追问你的一段科研经历，每轮带维度色标，结束后输出一份**可执行**的反馈
> 报告（薄弱点 + 红旗 + 可背的示范答法），并支持**针对任意薄弱点（含用户自填）再练
> 一轮**。

---

## 三种输入方式（多模态）

| 输入 | 用法 |
|---|---|
| **文字** | 直接粘贴/打字（textarea，必填或其下二者择一） |
| **简历 PDF** | 客户端 pdfjs-dist 渲染前 5 页为 PNG，AI 看图提取教育/项目列表 |
| **项目演示 PPT**（PDF） | 同上，前 20 页，AI 提取图表 + 关键数字 |
| **语音回答** | 面试中按 🎤 录音 → 火山引擎极速版 ASR → 转写填入输入框 |

> 「科研经历正文」和「简历 PDF」二选一必填；PPT 完全可选。

---

## 为什么"窄"到只服务 AI 方向？

题目原文："建议在用户群上做取舍，不要做得太泛。我们鼓励你做深做窄。"

AI 方向的特殊性让窄定位成立：

- **真实评审 norms 高度统一**：ablation / baseline / 统计显著性 / 复现性 / 数据泄漏，
  NeurIPS / CVPR / ACL / ICML 的 reviewer 规范几乎相同 → 可被 prompt 化
- **顶会审稿人"挖坑"模式可固化**：见 [lib/prompts/interviewer.ts](lib/prompts/interviewer.ts)
  里的「动机/Novelty 红旗 + 实验严谨性红旗 + 8 子方向高频追问主题」弹药库
- **本科生项目分布集中**：2026 年 AI 本科生科研项目落在 8 个子方向篮子里，prompt
  能精准命中；其他领域分布太散，AI 当 generalist 反而做不深

---

## 为什么它比直接用 ChatGPT 强

| 维度 | ChatGPT 直接问 | 本项目 |
|---|---|---|
| 追问框架 | 想到哪问到哪 | 五维度循环 + 阶段策略（开场 → 深挖 → 批判）|
| 领域知识 | 通用 | 内置 6 条动机红旗 + 9 条实验严谨性红旗 + 8 子方向高频追问 |
| 引用粒度 | 容易抽象 | 强制引用候选人材料里的具体数字、模型名、PPT 图表 |
| 多模态 | ❌ 看不见你 PPT 上的图 | ✅ Qwen3.6 Plus 视觉摘要简历 + PPT 内容 |
| 语音 | ❌ | ✅ 火山 ASR 录音转写，模拟复试紧张感 |
| 反馈形式 | 鼓励式总结 | 严格 0-10 评分 + 致命红旗 + **可直接背的示范答法** |
| 跨方向 | 通用 | **能区分"你做的方向"vs"目标导师方向"，做迁移追问** |
| 迭代练习 | ❌ | ✅ 报告页可多选薄弱点 + 自定义补充 → 一键开新会话定向再练 |
| 持久化 | 一关窗口就没 | SQLite 全档 + `/api/usage` 实时显示 token 与成本 |

---

## 用户路径

1. **首页** —— 选「目标导师方向」（8 子方向 + 其他自定义），填文字经历**或**上传简历 PDF（必有其一），可选上传项目演示 PPT
2. **创建会话** —— AI 先用 Qwen3.6 Plus 看完所有上传材料，摘要进 experience，再生成第一个追问
3. **面试页（流式聊天）** —— 按 Enter 发送 / Shift+Enter 换行 / 🎤 录音；每条 AI 追问显示维度色标
4. **结束 · 看报告** —— 至少 3 轮追问后可触发，AI 用 `generateObject` 严格 JSON 输出五维度评分 + 强项 + 薄弱点 + 红旗 + 改进示范法
5. **针对薄弱点再练一轮** —— 报告页勾选 AI 检测出的薄弱点（多选）+ 自定义补充宏观/微观弱点 → 一键开新会话，AI 围绕这些薄弱点定向深挖

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router、Turbopack）+ React 19 + Tailwind v4 |
| AI SDK | Vercel AI SDK 6（`streamText` / `generateObject` / `generateText` / `useChat`）|
| LLM | OpenRouter → **Qwen Plus 2025-07-28**（文本，$0.26 / $0.78 per MTok，1M 上下文，Alibaba 原生）+ **Qwen3.6 Plus**（多模态视觉摘要） |
| ASR | **火山引擎大模型录音文件识别 极速版**（同步 REST + base64） |
| PDF 渲染 | pdfjs-dist（客户端 canvas 渲染为 PNG） |
| 数据库 | Prisma 7 + better-sqlite3（本地文件即数据库，零运维） |
| 部署 | 阿里云 ECS + pm2 + Caddy（自动 HTTPS） |
| 成本追踪 | 自建 UsageLog 表，每次 LLM/ASR 调用记 token + micro-USD 成本 → `/api/usage` |

---

## 快速开始

```bash
# 1. 装依赖（postinstall 会自动跑 prisma generate + 复制 pdf.worker）
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填:
#   OPENROUTER_API_KEY=sk-or-v1-...
#   VOLC_APP_ID=...
#   VOLC_ACCESS_TOKEN=...
#   (VOLC 是用语音输入才需要)

# 3. 初始化数据库
npm run db:migrate

# 4. 启动
npm run dev
# 打开 http://localhost:3000
```

## 切换 LLM 模型

`.env.local` 改一行即可，无需改代码：

```bash
OPENROUTER_MAIN_MODEL="qwen/qwen-plus-2025-07-28"   # 默认推荐
# 备选:
# OPENROUTER_MAIN_MODEL="deepseek/deepseek-v3.2"
# OPENROUTER_MAIN_MODEL="mistralai/mistral-small-3.2-24b-instruct"  # 最便宜
```

国内服务器调 OpenAI 系列模型时需要 `OPENROUTER_PROVIDER_ORDER="Azure"` 绕过 CN
region block，详见 [lib/llm.ts](lib/llm.ts) 注释。

---

## 目录结构

```
app/
  page.tsx                       首页:选方向 + 三种输入入口
  interview/[id]/page.tsx        面试页(流式 SSE + 录音按钮)
  report/[id]/page.tsx           反馈报告页(评分 + 多选再练)
  api/
    sample/route.ts              AI 生成 AI 方向脱敏样例(lite model)
    session/route.ts             创建会话: vision 摘要 + 注入 weaknessFocuses
    chat/route.ts                多轮追问流式接口(useChat 后端)
    report/route.ts              generateObject 输出 JSON 报告
    transcribe/route.ts          语音转写中转(浏览器音频 → 火山 ASR)
    usage/route.ts               查询累计 token + cost(按会话或全局)
  generated/prisma/              Prisma Client(gitignore)
lib/
  db.ts                          Prisma + better-sqlite3 adapter
  llm.ts                         provider-agnostic LLM 客户端 + CN routing
  usage.ts                       pricing 表 + recordUsage(micro-USD 整数避免精度漂移)
  vision.ts                      Qwen3.6 Plus 多模态摘要(简历 + PPT 分类追问)
  volc-asr.ts                    火山引擎 ASR REST 客户端
  pdf-render.ts                  客户端 pdfjs-dist → canvas → PNG dataUrl
  prompts/
    interviewer.ts               五维度 + 8 子方向追问弹药库(差异化核心)
    report.ts                    评分锚点 + JSON schema
    sample.ts                    AI 方向样例生成
components/
  ExperienceForm.tsx             首页表单(文字 + 简历 + PPT 三槽位)
  InterviewChat.tsx              聊天 + MediaRecorder 录音
  ReportView.tsx                 评分卡 + 多选薄弱点 + 自定义再练
prisma/
  schema.prisma                  Session / Turn / Report / UsageLog
public/
  pdf.worker.min.mjs             pdfjs worker(postinstall 复制)
  voice-test.html                独立测试页:验证浏览器 Web Speech API 可用性
```

---

## 部署到云服务器（pm2 + Caddy）

```bash
# 在服务器上
git pull
npm ci
npm run db:deploy       # 应用 Prisma migration
npm run build
pm2 start npm --name aiic -- start

# Caddyfile 示例(自动 HTTPS):
# yourdomain.com {
#     reverse_proxy localhost:3000
# }
```

---

## AI 工具使用说明（评分必交项）

| 工具 | 用途 |
|---|---|
| **Claude Code（Opus 4.7）** | 全部代码 + system prompt 设计 + README + 自测脚本 + 调研写作 |
| **Qwen Plus 2025-07-28**（via OpenRouter）| 运行时面试官、报告生成、样例经历生成 |
| **Qwen3.6 Plus**（via OpenRouter）| 简历 + PPT 多模态视觉摘要 |
| **火山引擎大模型录音文件识别 极速版** | 中文语音转写（≈1s 延迟） |

> 选型说明：OpenRouter shared key 在 CN region 不可达 Anthropic / Google 模型且
> 多数 provider 被账号 data-policy 拦截；Qwen 系列在 Alibaba 原生托管国内无网络
> 问题。Anthropic Claude 我们只在开发期通过 Claude Code 使用，运行时全靠 OpenRouter。

---

## 刻意没做的（v0 边界）

- ❌ 用户登录 / 账号系统 —— 16h MVP 不该做 auth，且评委只跑 1 次体验
- ❌ 跨会话错题本 —— 在 v1 路线图，需要 server-auth 才能可靠持久化
- ❌ 英语口语对练 —— 流利说做了 8 年，差异化不可能
- ❌ 专业课问答 —— 牛客刷题更专业
- ❌ 多导师人格对比 —— 复杂度爆，差异化收益低
- ❌ 完整保研流程覆盖（自我介绍 / 综合素质等）—— 违背"做窄做深"

---

## License

MIT — see [LICENSE](LICENSE).
