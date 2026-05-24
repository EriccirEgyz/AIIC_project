"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderPdfToImages, type RenderedPage } from "@/lib/pdf-render";

const FIELD_PRESETS = [
  "大语言模型 / Agent / RLHF",
  "计算机视觉(经典任务)",
  "多模态 / 视觉语言模型",
  "生成模型 / 扩散模型",
  "强化学习 / 决策智能",
  "推荐 / 搜索 / 广告",
  "机器学习理论 / 算法",
  "模型效率 / 推理优化",
];
const FIELD_CUSTOM = "__custom__";
const MAX_RESUME_PAGES = 5;
const MAX_PPT_PAGES = 20;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const LENGTH_OPTIONS = [
  { value: 5, label: "短 · 约 5 轮", hint: "快速过,只挖最关键" },
  { value: 10, label: "中 · 约 10 轮", hint: "一场完整复盘(默认)" },
  { value: 15, label: "长 · 约 15 轮", hint: "完整复试模拟,多项目深挖" },
] as const;

type Slot = "resume" | "ppt";

const SLOT_META: Record<
  Slot,
  { title: string; hint: string; maxPages: number }
> = {
  resume: {
    title: "简历 PDF",
    hint: "目标导师面试前会先翻你的简历 — 教育背景、项目列表、奖项。",
    maxPages: MAX_RESUME_PAGES,
  },
  ppt: {
    title: "项目演示 PPT",
    hint: "让 AI 像导师那样翻看你的实验图、方法图和关键数字。",
    maxPages: MAX_PPT_PAGES,
  },
};

export default function ExperienceForm() {
  const router = useRouter();
  const [fieldChoice, setFieldChoice] = useState<string>(FIELD_PRESETS[0]);
  const [customField, setCustomField] = useState("");
  const [targetTurns, setTargetTurns] = useState<number>(10);
  const [experience, setExperience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 每类 PDF 独立状态: 文件名 + 渲染好的页面 + 当前是否渲染中
  const [resume, setResume] = useState<{
    name: string;
    pages: RenderedPage[];
  } | null>(null);
  const [ppt, setPpt] = useState<{ name: string; pages: RenderedPage[] } | null>(
    null,
  );
  const [rendering, setRendering] = useState<Slot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const resumeRef = useRef<HTMLInputElement>(null);
  const pptRef = useRef<HTMLInputElement>(null);

  // 提交后开始计时,让用户看到进度
  // 只在 isPending=true 时跑计时器;isPending=false 时计数器值不再被读(submitLabel
  // 里"开始模拟追问 →"分支不引用 elapsedSec),所以无需 reset 回 0。
  useEffect(() => {
    if (!isPending) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isPending]);

  const field =
    fieldChoice === FIELD_CUSTOM ? customField.trim() : fieldChoice;

  function validateField(): string | null {
    if (fieldChoice === FIELD_CUSTOM && customField.trim().length < 2) {
      return "请填写自定义研究方向(至少 2 字)";
    }
    return null;
  }

  function hasEnoughContent(): boolean {
    const enoughText = experience.trim().length >= 20;
    const hasResume = (resume?.pages.length ?? 0) > 0;
    return enoughText || hasResume;
  }

  async function generateSample() {
    setError(null);
    const fieldErr = validateField();
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
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

  async function handlePdfPick(
    slot: Slot,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const { maxPages, title } = SLOT_META[slot];
    if (file.type !== "application/pdf") {
      setError(
        `${title} 只支持 PDF 文件(PowerPoint 请先「另存为 PDF」)`,
      );
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`${title} 不能超过 ${MAX_PDF_BYTES / 1024 / 1024}MB`);
      return;
    }
    setRendering(slot);
    try {
      const rendered = await renderPdfToImages(file, { maxPages });
      const entry = { name: file.name, pages: rendered };
      if (slot === "resume") setResume(entry);
      else setPpt(entry);
    } catch (err) {
      setError(`${title} 解析失败: ${(err as Error).message}`);
    } finally {
      setRendering(null);
    }
  }

  function clearPdf(slot: Slot) {
    if (slot === "resume") {
      setResume(null);
      if (resumeRef.current) resumeRef.current.value = "";
    } else {
      setPpt(null);
      if (pptRef.current) pptRef.current.value = "";
    }
  }

  async function startInterview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fieldErr = validateField();
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
    if (!hasEnoughContent()) {
      setError("请至少填写一段科研经历(20 字以上)或上传简历 PDF。");
      return;
    }
    setElapsedSec(0);
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = { field, targetTurns };
        if (experience.trim()) body.experience = experience.trim();
        if (resume && resume.pages.length > 0) {
          body.resumeImages = resume.pages.map((p) => ({ dataUrl: p.dataUrl }));
        }
        if (ppt && ppt.pages.length > 0) {
          body.pptImages = ppt.pages.map((p) => ({ dataUrl: p.dataUrl }));
        }
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? "创建失败");
        router.push(`/interview/${data.sessionId}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const pageInfo = (() => {
    const r = resume?.pages.length ?? 0;
    const p = ppt?.pages.length ?? 0;
    if (r && p) return `简历 ${r} 页 + 项目演示 PPT ${p} 页`;
    if (r) return `简历 ${r} 页`;
    if (p) return `项目演示 PPT ${p} 页`;
    return "";
  })();
  const hasMaterials = pageInfo.length > 0;

  const submitLabel = (() => {
    if (!isPending) return "开始模拟追问 →";
    const tick = elapsedSec > 0 ? ` · ${elapsedSec}s` : "";
    if (hasMaterials) {
      return `导师正在翻你的材料(${pageInfo})…${tick}`;
    }
    return `正在为你叫醒一位 985 导师…${tick}`;
  })();

  return (
    <form
      onSubmit={startInterview}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">目标导师方向</span>
          <select
            value={fieldChoice}
            onChange={(e) => setFieldChoice(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            {FIELD_PRESETS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value={FIELD_CUSTOM}>其他(自定义)…</option>
          </select>
          {fieldChoice === FIELD_CUSTOM && (
            <input
              type="text"
              value={customField}
              onChange={(e) => setCustomField(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              placeholder="如 AI for Science / 类脑计算 / 神经辐射场"
              maxLength={60}
              autoFocus
              required
            />
          )}
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            你想申请的导师所在的研究方向。AI 会按&ldquo;这位导师&rdquo;的视角追问你。
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium">本场时长</span>
          <select
            value={targetTurns}
            onChange={(e) => setTargetTurns(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            {LENGTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            预期问答轮数。AI 会按这个预算分配节奏:多项目时自动轮转,接近尾声时收尾。
          </p>
        </label>
      </div>

      {/* 提示: 至少要有文字 或 简历 */}
      <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/60 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        下面三项内容,
        <strong className="text-zinc-900 dark:text-zinc-100">
          「科研经历正文」和「简历 PDF」至少有一个
        </strong>
        ;项目演示 PPT 完全可选(上传后追问会更具体)。
      </div>

      {/* 文字经历 */}
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
          rows={8}
          maxLength={8000}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-y"
          placeholder={`粘贴或直接写下你的科研经历，包含：\n  · 课题是什么\n  · 你负责的部分\n  · 用了什么方法\n  · 拿到什么结果`}
        />
        <div className="mt-1 text-xs text-zinc-400 text-right">
          {experience.length} / 8000
        </div>
      </div>

      <PdfSlot
        slot="resume"
        state={resume}
        onPick={(e) => handlePdfPick("resume", e)}
        onClear={() => clearPdf("resume")}
        inputRef={resumeRef}
        rendering={rendering === "resume"}
      />

      <PdfSlot
        slot="ppt"
        state={ppt}
        onPick={(e) => handlePdfPick("ppt", e)}
        onClear={() => clearPdf("ppt")}
        inputRef={pptRef}
        rendering={rendering === "ppt"}
      />

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">⚠ {error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || rendering !== null}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
      >
        {submitLabel}
      </button>
      {isPending && hasMaterials && (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 -mt-2">
          AI 正在逐页阅读 — 通常 10-30 秒,大 PDF 文件可能更久。请耐心等待。
        </p>
      )}
    </form>
  );
}

function PdfSlot({
  slot,
  state,
  onPick,
  onClear,
  inputRef,
  rendering,
}: {
  slot: Slot;
  state: { name: string; pages: RenderedPage[] } | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  rendering: boolean;
}) {
  const meta = SLOT_META[slot];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{meta.title}</span>
        {state && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
          >
            移除
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        {meta.hint}
      </p>
      {!state && !rendering && (
        <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-5 text-center text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPick}
            className="hidden"
          />
          点击选择 PDF · 最多 {meta.maxPages} 页 · 最大{" "}
          {MAX_PDF_BYTES / 1024 / 1024}MB
        </label>
      )}
      {rendering && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-5 text-center text-sm text-zinc-500 animate-pulse">
          正在加载预览…
        </div>
      )}
      {state && state.pages.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-2">
            ✓ <strong>{state.name}</strong> · {state.pages.length} 页已加载
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {state.pages.map((p) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={p.pageNumber}
                src={p.dataUrl}
                alt={`第 ${p.pageNumber} 页`}
                className="h-32 w-auto rounded border border-zinc-200 dark:border-zinc-700 bg-white"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
