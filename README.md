# 保研深挖 · 科研经历模拟面试

> 北大 AIIC 16 小时项目挑战 · 2026-05-24
>
> 给保研复试生用的 AI 模拟面试官 —— 不是泛泛聊，而是像真实导师一样按
> 「动机 / 方法 / 数据 / 困难 / 反思」五维度连续追问你的一段科研经历，
> 结束后输出一份**可执行**的反馈报告（薄弱点 + 红旗 + 示范答法）。

## 为什么它比直接用 ChatGPT 强

| | ChatGPT 直接问 | 本项目 |
|---|---|---|
| 追问框架 | 想到哪问到哪 | 五维度循环，覆盖导师真实关注点 |
| 追问粒度 | 容易抽象 | 强制引用你原文细节、禁止口号式提问 |
| 反馈形式 | 鼓励式总结 | 严格 0-10 评分 + 致命红旗 + 可背的示范答法 |
| 持久化 | 一关窗口就没 | SQLite 存所有会话，可复盘 |

## 技术栈

- **Next.js 16** (App Router, TS, Turbopack) + Tailwind v4
- **Vercel AI SDK 6** (`streamText` / `generateObject` / `useChat`)
- **Prisma 7** + **better-sqlite3** (本地文件即数据库，零运维)
- **LLM 提供商可切换**：OpenRouter (默认 → Claude Sonnet 4.6) / DeepSeek / 通义千问
- React 19

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

## 切换 LLM 提供商

国内服务器调 `openrouter.ai` 经常超时，可一行切换：

```bash
# .env.local
LLM_PROVIDER="deepseek"    # 或 "qwen"
DEEPSEEK_API_KEY="sk-..."
```

无需改代码。详见 [lib/llm.ts](lib/llm.ts)。

## 目录结构

```
app/
  page.tsx                    首页：输入经历、选导师风格
  interview/[id]/page.tsx     聊天页（流式 SSE）
  report/[id]/page.tsx        反馈报告页
  api/
    sample/route.ts           AI 生成脱敏样例经历
    session/route.ts          创建会话 + 生成开场问题
    chat/route.ts             多轮追问流式接口
    report/route.ts           generateObject 输出 JSON 报告
  generated/prisma/           Prisma Client 输出（gitignore）
lib/
  db.ts                       Prisma 单例 + SQLite adapter
  llm.ts                      provider-agnostic LLM 客户端
  prompts/
    interviewer.ts            五维度追问 system prompt（差异化核心）
    report.ts                 评分锚点 + JSON schema
    sample.ts                 样例生成
components/
  ExperienceForm.tsx
  InterviewChat.tsx
  ReportView.tsx
prisma/
  schema.prisma               Session / Turn / Report
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

## AI 工具使用说明

- **Claude Code (Opus 4.7)** 写所有代码（系统 prompt、API 路由、UI、Prisma schema、本 README）
- **Claude Sonnet 4.6 via OpenRouter** 作为运行时面试官 + 报告生成
- **Claude Haiku 4.5 via OpenRouter** 作为脱敏样例生成（成本优化）

## License

MIT — see [LICENSE](LICENSE).
