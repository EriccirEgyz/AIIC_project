import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import InterviewChat from "@/components/InterviewChat";
import type { UIMessage } from "ai";

type Params = Promise<{ id: string }>;

export default async function InterviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      turns: { orderBy: { createdAt: "asc" } },
      report: true,
    },
  });
  if (!session) notFound();
  // 报告已生成 = 本场对话已结束。仍允许进来"回看",但 InterviewChat 走 readOnly 模式
  // (隐藏输入区,顶部加 banner 引导回报告页)
  const isReadOnly = !!session.report;

  const initialMessages: UIMessage[] = session.turns.map((t) => ({
    id: t.id,
    role: t.role === "interviewer" ? "assistant" : "user",
    parts: [{ type: "text", text: t.content }],
    metadata: t.dimension ? { dimension: t.dimension } : undefined,
  }));

  return (
    <main className="flex-1 flex flex-col w-full">
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between text-sm">
          <a
            href="/"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← 回首页
          </a>
          <div className="text-zinc-500">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {session.field}
            </span>{" "}
            导师追问
          </div>
        </div>
      </header>
      <InterviewChat
        sessionId={id}
        initialMessages={initialMessages}
        readOnly={isReadOnly}
      />
    </main>
  );
}
