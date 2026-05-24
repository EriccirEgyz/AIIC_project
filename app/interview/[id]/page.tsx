import { notFound, redirect } from "next/navigation";
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
  if (session.report) redirect(`/report/${id}`);

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
            <span className="hidden sm:inline">{session.field} · </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {tierLabel(session.targetTier)}
            </span>{" "}
            导师追问
          </div>
        </div>
      </header>
      <InterviewChat sessionId={id} initialMessages={initialMessages} />
    </main>
  );
}

function tierLabel(t: string) {
  return t === "top5" ? "Top 5" : t === "top10" ? "Top 10" : "211";
}
