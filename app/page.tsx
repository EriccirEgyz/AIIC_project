import ExperienceForm from "@/components/ExperienceForm";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <section className="max-w-3xl w-full mx-auto px-6 pt-16 pb-6">
        <p className="text-xs tracking-widest uppercase text-zinc-500 mb-3">
          AI Mock Interviewer · AI 方向保研复试
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          像 AI 顶会审稿人一样
          <br />
          挖一遍你的科研经历
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 leading-7">
          专为想保研到
          <strong className="text-zinc-900 dark:text-zinc-100">人工智能方向</strong>
          的本科生设计：粘贴你的一段科研经历，模拟导师按
          <strong className="text-zinc-900 dark:text-zinc-100">
            「动机 / 方法 / 数据 / 困难 / 反思」
          </strong>
          五维度连续追问 5-10 轮，结束后输出
          <strong className="text-zinc-900 dark:text-zinc-100">
            可执行反馈报告
          </strong>
          ：薄弱点、红旗、示范答法。
        </p>
        <ul className="mt-5 text-sm text-zinc-500 dark:text-zinc-400 space-y-1.5">
          <li>
            · 不是聊天，是
            <span className="text-rose-600 dark:text-rose-400">
              基于你原文细节的定向追问
            </span>
            （会引用具体数字 / 模型名 / 数据集）
          </li>
          <li>
            · 内置 AI 领域真实评审 norms：ablation / baseline / 统计显著性 / 复现性
          </li>
          <li>
            · 不给鼓励，只给「真实 AI 方向导师此刻会追问什么 / 你被刷的硬伤在哪」
          </li>
          <li>
            · 用脱敏数据测试，<strong>不要</strong>粘贴真人个人信息
          </li>
        </ul>
      </section>
      <section className="max-w-3xl w-full mx-auto px-6 pb-24">
        <ExperienceForm />
      </section>
      <footer className="mt-auto py-8 text-center text-xs text-zinc-400">
        北大 AIIC 16h Challenge · 2026-05-24 · powered by Qwen Plus
      </footer>
    </main>
  );
}
