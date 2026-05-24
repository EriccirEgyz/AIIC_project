"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const FIELD_PRESETS = [
  "计算机视觉",
  "自然语言处理",
  "机器学习理论",
  "操作系统/系统",
  "数据库",
  "凝聚态物理",
  "高分子化学",
  "细胞生物学",
  "金融数学",
  "认知神经科学",
];

const TIERS = [
  { value: "top5", label: "Top 5 (清北复交浙)", hint: "犀利、刨根问底" },
  { value: "top10", label: "Top 10 / C9", hint: "严谨、关注复现" },
  { value: "211", label: "211 / 双一流", hint: "友善但专业" },
] as const;

export default function ExperienceForm() {
  const router = useRouter();
  const [field, setField] = useState(FIELD_PRESETS[0]);
  const [targetTier, setTargetTier] =
    useState<(typeof TIERS)[number]["value"]>("top5");
  const [experience, setExperience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function generateSample() {
    setError(null);
    setGenLoading(true);
    try {
      const res = await fetch("/api/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "生成失败");
      setExperience(data.experience);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenLoading(false);
    }
  }

  async function startInterview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (experience.trim().length < 20) {
      setError("科研经历至少 20 字");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experience, field, targetTier }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? "创建失败");
        router.push(`/interview/${data.sessionId}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <form
      onSubmit={startInterview}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">研究方向</span>
          <input
            list="field-presets"
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            placeholder="如 计算机视觉"
            maxLength={60}
            required
          />
          <datalist id="field-presets">
            {FIELD_PRESETS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium">目标院校层次</span>
          <select
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as typeof targetTier)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.hint}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="exp" className="text-sm font-medium">
            科研经历正文
          </label>
          <button
            type="button"
            onClick={generateSample}
            disabled={genLoading}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 underline underline-offset-2"
          >
            {genLoading ? "生成中…" : "用 AI 帮我生成一段脱敏样例"}
          </button>
        </div>
        <textarea
          id="exp"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          rows={10}
          maxLength={8000}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-y"
          placeholder={`粘贴或直接写下你的一段科研经历，200-500 字最佳。包含：\n  · 课题是什么\n  · 你负责的部分\n  · 用了什么方法\n  · 拿到什么结果\n（脱敏，不要包含真实姓名、学校、实验室名）`}
          required
        />
        <div className="mt-1 text-xs text-zinc-400 text-right">
          {experience.length} / 8000
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">⚠ {error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
      >
        {isPending ? "正在为你叫醒一位 985 导师…" : "开始模拟追问 →"}
      </button>
    </form>
  );
}
