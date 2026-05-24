"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportJson } from "@/lib/prompts/report";

const DIM_LABELS: { key: keyof ReportJson["scores"]; label: string }[] = [
  { key: "motivation", label: "动机" },
  { key: "method", label: "方法" },
  { key: "data", label: "数据/结果" },
  { key: "failure", label: "困难/失败" },
  { key: "reflection", label: "反思/展望" },
];

export default function ReportView({
  report,
  sessionId,
}: {
  report: ReportJson | null;
  sessionId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
        <p className="text-zinc-500 mb-4">这次面试还没有生成报告。</p>
        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">
            ⚠ {error}
          </p>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "AI 评分中…" : "立即生成反馈报告"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-500">综合评分</span>
          <span className="text-4xl font-semibold tabular-nums">
            {report.overall.toFixed(1)}
            <span className="text-base text-zinc-400"> / 10</span>
          </span>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-3">
          {DIM_LABELS.map(({ key, label }) => (
            <ScorePill key={key} label={label} score={report.scores[key]} />
          ))}
        </div>
      </div>

      {report.redFlags.length > 0 && (
        <Section title="🚩 致命红旗 — 真实复试可能因此直接被刷" tone="rose">
          <ul className="space-y-2">
            {report.redFlags.map((f, i) => (
              <li key={i} className="text-sm leading-6">
                · {f}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="✅ 答得不错的地方" tone="emerald">
        <ul className="space-y-2">
          {report.strengths.map((s, i) => (
            <li key={i} className="text-sm leading-6">
              · {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="⚠ 薄弱点（按严重度）" tone="amber">
        <ol className="space-y-2 list-decimal list-inside">
          {report.weaknesses.map((w, i) => (
            <li key={i} className="text-sm leading-6">
              {w}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="🎯 可执行改进 — 附示范答法" tone="sky">
        <div className="space-y-5">
          {report.improvements.map((imp, i) => (
            <div
              key={i}
              className="border-l-2 border-sky-400 dark:border-sky-600 pl-4"
            >
              <p className="text-sm font-medium">{imp.issue}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-6">
                {imp.suggestion}
              </p>
              <div className="mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                <p className="text-[11px] text-zinc-500 mb-1">示范回答</p>
                <p className="text-sm leading-6">{imp.exampleAnswer}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex gap-3 pt-4">
        <a
          href="/"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm text-center hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          再练一段
        </a>
        <a
          href={`/interview/${sessionId}`}
          className="flex-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm text-center font-medium"
        >
          回看对话
        </a>
      </div>
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 8
      ? "bg-emerald-500"
      : score >= 6
        ? "bg-sky-500"
        : score >= 4
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div className="text-center">
      <div className="text-[11px] text-zinc-500 mb-1.5">{label}</div>
      <div className="text-lg font-semibold tabular-nums">
        {score.toFixed(1)}
      </div>
      <div className="mt-1.5 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  rose: "border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20",
  emerald:
    "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20",
  amber:
    "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20",
  sky: "border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20",
};

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "rose" | "emerald" | "amber" | "sky";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${TONE_BG[tone]}`}
    >
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}
