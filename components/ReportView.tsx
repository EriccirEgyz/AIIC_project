"use client";

import { useState } from "react";
import Link from "next/link";
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
  originalExperience,
  originalField,
}: {
  report: ReportJson | null;
  sessionId: string;
  /** 原会话的 experience(已合并 vision 摘要),用于"针对薄弱点再练"时复用上下文 */
  originalExperience: string;
  originalField: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "针对薄弱点再练一轮" — 支持多选 AI 检测出的薄弱点 + 自定义补充
  const [selectedAi, setSelectedAi] = useState<Set<number>>(new Set());
  const [customText, setCustomText] = useState("");
  const [focusLoading, setFocusLoading] = useState(false);
  const [focusError, setFocusError] = useState<string | null>(null);

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

  function toggleAi(idx: number) {
    setSelectedAi((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // 汇总要发给后端的薄弱点列表
  function collectFocuses(weaknesses: string[]): string[] {
    const fromAi = Array.from(selectedAi)
      .sort((a, b) => a - b)
      .map((i) => weaknesses[i])
      .filter(Boolean);
    const fromCustom = customText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // 简单去重(完全相同的文本不重复)
    return Array.from(new Set([...fromAi, ...fromCustom]));
  }

  async function practiceOnSelected(weaknesses: string[]) {
    const focuses = collectFocuses(weaknesses);
    if (focuses.length === 0) {
      setFocusError("请先勾选或写入至少一个薄弱点");
      return;
    }
    setFocusError(null);
    setFocusLoading(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience: originalExperience,
          field: originalField,
          weaknessFocuses: focuses,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? data.error ?? "创建新一轮失败");
      router.push(`/interview/${data.sessionId}`);
    } catch (e) {
      setFocusError((e as Error).message);
      setFocusLoading(false);
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

  const focusCount =
    selectedAi.size +
    customText.split("\n").map((s) => s.trim()).filter(Boolean).length;

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

      {/* 弱点 + 再练一轮合并成一块,避免用户勾选后还要滚过长的"改进示范" 才看到按钮 */}
      <Section title="⚠ 薄弱点 + 针对性再练一轮" tone="amber">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-6">
          勾选 AI 检测出的薄弱点,可叠加自填弱点(支持宏观认知如&ldquo;对 transformer
          训练范式不熟&rdquo;),一键开新会话定向深挖。
        </p>
        <ul className="space-y-2.5 mb-4">
          {report.weaknesses.map((w, i) => (
            <li key={i}>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedAi.has(i)}
                  onChange={() => toggleAi(i)}
                  disabled={focusLoading}
                  className="mt-1 accent-amber-600 disabled:opacity-50"
                />
                <span className="text-sm leading-6 flex-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  {w}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
          自填薄弱点 <span className="text-zinc-400">(每行一条,留空就只用上方勾选的)</span>
        </p>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={`如:\n对所做领域的宏观认识不足\n对 ablation 的设计思路不熟悉`}
          rows={3}
          maxLength={2000}
          disabled={focusLoading}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50 resize-y"
        />
        {focusError && (
          <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">
            ⚠ {focusError}
          </p>
        )}
        <button
          type="button"
          onClick={() => practiceOnSelected(report.weaknesses)}
          disabled={focusLoading || focusCount === 0}
          className="mt-3 w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {focusLoading
            ? `准备中…(${focusCount} 项)`
            : focusCount === 0
              ? "请先勾选或写入至少一个薄弱点"
              : `针对选中的 ${focusCount} 个薄弱点再练一轮 →`}
        </button>
      </Section>

      <Section title="🎯 高价值问题 — 示范回答" tone="sky">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-6">
          挑出本场答得最薄弱、或真实复试出现概率最高的 2-3 个问题,给出第一人称示范答法(300-500 字)。
          示范基于你的真实经历,如出现「请按真实情况替换」字样,说明 AI 没拿到具体数字,请自己补。
        </p>
        <div className="space-y-6">
          {(report.modelAnswers ?? []).map((qa, i) => (
            <div
              key={i}
              className="border-l-2 border-sky-400 dark:border-sky-600 pl-4"
            >
              <p className="text-[11px] tracking-widest uppercase text-sky-700 dark:text-sky-400 mb-1.5">
                面试官问 · {i + 1}
              </p>
              <p className="text-sm font-medium leading-6">{qa.question}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 leading-6">
                <span className="font-medium">你那条的问题:</span> {qa.yourIssue}
              </p>
              <div className="mt-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-4 py-3">
                <p className="text-[11px] text-zinc-500 mb-1.5">示范回答</p>
                <p className="text-sm leading-7 whitespace-pre-wrap">
                  {qa.modelAnswer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex gap-3 pt-4">
        <Link
          href="/"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm text-center hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          再练一段
        </Link>
        <Link
          href={`/interview/${sessionId}`}
          className="flex-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm text-center font-medium"
        >
          回看对话
        </Link>
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
    <section className={`rounded-2xl border p-5 ${TONE_BG[tone]}`}>
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}
