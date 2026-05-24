import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ReportView from "@/components/ReportView";
import type { ReportJson } from "@/lib/prompts/report";

type Params = Promise<{ id: string }>;

export default async function ReportPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { report: true, turns: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) notFound();

  let report: ReportJson | null = null;
  if (session.report) {
    try {
      report = JSON.parse(session.report.scoresJson) as ReportJson;
    } catch {
      report = null;
    }
  }

  return (
    <main className="flex-1 flex flex-col w-full">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between text-sm">
          <a
            href="/"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← 回首页
          </a>
          <a
            href={`/interview/${id}`}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            重看对话 →
          </a>
        </div>
      </header>
      <div className="max-w-3xl w-full mx-auto px-6 py-10">
        <p className="text-xs tracking-widest uppercase text-zinc-500">
          反馈报告
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-2 mb-6">
          {session.field} 导师追问总结
        </h1>
        <ReportView
          report={report}
          sessionId={id}
          originalExperience={session.experience}
          originalField={session.field}
        />
      </div>
    </main>
  );
}
