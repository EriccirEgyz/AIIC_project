"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderPdfToImages, type RenderedPage } from "@/lib/pdf-render";

// 8 大类按 2026 本科生 AI 项目真实分布排序(综合 NeurIPS 2025 主题分布 +
// 国内高校 AI 招生方向 + 知乎讨论)。「其他」兜底 AI4Sci/MLSys/具身/AI 安全
// 等长尾(本科生群体里量都很小)。
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
const MAX_PDF_PAGES = 5;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function ExperienceForm() {
  const router = useRouter();
  const [fieldChoice, setFieldChoice] = useState<string>(FIELD_PRESETS[0]);
  const [customField, setCustomField] = useState("");
  const [experience, setExperience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfRendering, setPdfRendering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 真正发给 API 的方向值:预设直接用,自定义用 customField。
  const field =
    fieldChoice === FIELD_CUSTOM ? customField.trim() : fieldChoice;

  function validateField(): string | null {
    if (fieldChoice === FIELD_CUSTOM && customField.trim().length < 2) {
      return "请填写自定义研究方向(至少 2 字)";
    }
    return null;
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

  async function handlePdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("只支持 PDF 文件(PPT 请先在 PowerPoint 里导出为 PDF)");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`PDF 不能超过 ${MAX_PDF_BYTES / 1024 / 1024}MB`);
      return;
    }
    setPdfName(file.name);
    setPdfRendering(true);
    setPages([]);
    try {
      const rendered = await renderPdfToImages(file, {
        maxPages: MAX_PDF_PAGES,
      });
      setPages(rendered);
    } catch (err) {
      setError(`PDF 解析失败: ${(err as Error).message}`);
      setPdfName(null);
    } finally {
      setPdfRendering(false);
    }
  }

  function clearPdf() {
    setPages([]);
    setPdfName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function startInterview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fieldErr = validateField();
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
    if (experience.trim().length < 20) {
      setError("科研经历至少 20 字");
      return;
    }
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = { experience, field };
        if (pages.length > 0) {
          body.images = pages.map((p) => ({ dataUrl: p.dataUrl }));
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

  return (
    <form
      onSubmit={startInterview}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6"
    >
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
          你想申请的导师所在的研究方向。
          <span className="text-zinc-400 dark:text-zinc-500">
            不一定等于你已做项目的方向 — AI 会按"这位导师"的视角追问你。
          </span>
        </p>
      </label>

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
          placeholder={`粘贴或直接写下你的一段科研经历，200-500 字最佳。包含：\n  · 课题是什么\n  · 你负责的部分\n  · 用了什么方法\n  · 拿到什么结果`}
          required
        />
        <div className="mt-1 text-xs text-zinc-400 text-right">
          {experience.length} / 8000
        </div>
      </div>

      {/* PDF 上传(可选) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium">
            简历 / PPT 上传{" "}
            <span className="text-xs font-normal text-zinc-400">
              (可选 · 真实复试时导师会看)
            </span>
          </span>
          {pdfName && (
            <button
              type="button"
              onClick={clearPdf}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
            >
              移除
            </button>
          )}
        </div>
        {pages.length === 0 && !pdfRendering && (
          <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfPick}
              className="hidden"
            />
            点击选择 PDF · 最多 {MAX_PDF_PAGES} 页 · 最大{" "}
            {MAX_PDF_BYTES / 1024 / 1024}MB
            <div className="mt-1 text-xs text-zinc-400">
              PPT 请先在 PowerPoint 里另存为 PDF
            </div>
          </label>
        )}
        {pdfRendering && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500 animate-pulse">
            正在渲染 PDF 页面…
          </div>
        )}
        {pages.length > 0 && (
          <div>
            <div className="text-xs text-zinc-500 mb-2">
              ✓ 已加载 <strong>{pdfName}</strong> · {pages.length} 页 · AI
              将在开场前先"翻一遍"你的材料
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pages.map((p) => (
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

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">⚠ {error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || pdfRendering}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
      >
        {isPending
          ? pages.length > 0
            ? "导师正在翻你的材料…"
            : "正在为你叫醒一位 985 导师…"
          : "开始模拟追问 →"}
      </button>
    </form>
  );
}
