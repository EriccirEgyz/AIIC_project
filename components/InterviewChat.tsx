"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractDimension } from "@/lib/prompts/interviewer";

const DIM_LABEL: Record<string, string> = {
  motivation: "动机",
  method: "方法",
  data: "数据",
  failure: "困难",
  reflection: "反思",
};
const DIM_COLOR: Record<string, string> = {
  motivation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  method: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  data: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  failure: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  reflection: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
};

type RecState = "idle" | "recording" | "transcribing";

export default function InterviewChat({
  sessionId,
  initialMessages,
  readOnly = false,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  /** 报告已生成时为 true:只渲染历史消息,隐藏输入区 */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- 录音状态 ----
  const [recState, setRecState] = useState<RecState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, status]);

  // 清理录音 effect
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream
        ?.getTracks()
        .forEach((t) => t.stop());
    };
  }, []);

  const isBusy = status === "submitted" || status === "streaming";
  const interviewerTurns = messages.filter((m) => m.role === "assistant").length;
  const canFinish = interviewerTurns >= 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  async function finishInterview() {
    setReportError(null);
    setReportLoading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);
      router.push(`/report/${sessionId}`);
    } catch (e) {
      setReportError((e as Error).message);
      setReportLoading(false);
    }
  }

  // ---- 录音逻辑 ----
  async function startRecording() {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("当前浏览器不支持录音(请用 Chrome / Edge)");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setVoiceError("当前浏览器不支持 MediaRecorder");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void handleTranscribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
      setRecSeconds(0);
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        setVoiceError("麦克风权限被拒绝,请在浏览器地址栏左侧重新授权");
      } else {
        setVoiceError(`录音启动失败: ${err.message}`);
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recState === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecState("transcribing");
    }
  }

  async function handleTranscribe(blob: Blob) {
    try {
      const form = new FormData();
      form.append("audio", blob, "recording");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { text?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "转写失败");
      // 把转写结果追加到 input(不直接发送,允许用户编辑)
      setInput((prev) =>
        prev.trim() ? `${prev.trim()} ${data.text ?? ""}` : data.text ?? "",
      );
    } catch (e) {
      setVoiceError(`转写失败: ${(e as Error).message}`);
    } finally {
      setRecState("idle");
      setRecSeconds(0);
    }
  }

  function toggleRecording() {
    if (recState === "idle") void startRecording();
    else if (recState === "recording") stopRecording();
  }

  return (
    <div className="flex-1 flex flex-col">
      {readOnly && (
        <div className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-200 dark:border-sky-900/50 px-6 py-2.5 text-sm text-sky-900 dark:text-sky-100 text-center">
          本场对话已结束 · 只读模式 ·{" "}
          <a
            href={`/report/${sessionId}`}
            className="underline font-medium hover:text-sky-700 dark:hover:text-sky-200"
          >
            回到反馈报告 →
          </a>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 sm:py-10 max-w-3xl mx-auto w-full space-y-6"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-zinc-400 pt-10">
            导师正在准备开场问题…
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isBusy &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <Avatar role="assistant" />
              <div className="text-sm text-zinc-400 pt-2 animate-pulse">
                导师思考中…
              </div>
            </div>
          )}
        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">
            ⚠ {error.message}
          </div>
        )}
      </div>

      {!readOnly && (
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto w-full px-6 py-4">
          {(reportError || voiceError) && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">
              ⚠ {reportError ?? voiceError}
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isBusy || recState === "transcribing"}
              title={
                recState === "idle"
                  ? "按一下开始录音,再按一下停止"
                  : recState === "recording"
                    ? "正在录音,点击停止"
                    : "转写中..."
              }
              className={`shrink-0 self-stretch w-12 rounded-lg border text-lg transition-colors disabled:opacity-40 ${
                recState === "recording"
                  ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                  : recState === "transcribing"
                    ? "bg-zinc-300 text-zinc-700 border-zinc-300"
                    : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {recState === "recording"
                ? `⏹${recSeconds}s`
                : recState === "transcribing"
                  ? "⋯"
                  : "🎤"}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              rows={2}
              placeholder={
                isBusy
                  ? "导师还在说话…"
                  : recState === "recording"
                    ? "正在录音,说完点击停止"
                    : "Enter 发送 · Shift+Enter 换行 · 🎤 录音"
              }
              disabled={isBusy || recState !== "idle"}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50"
            />
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isBusy || !input.trim() || recState !== "idle"}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 transition-colors"
              >
                发送
              </button>
              <button
                type="button"
                onClick={finishInterview}
                disabled={!canFinish || reportLoading || isBusy}
                title={
                  canFinish
                    ? "结束面试并生成反馈报告"
                    : `至少完成 3 轮追问 (当前 ${interviewerTurns}/3)`
                }
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {reportLoading ? "生成中…" : "结束 · 看报告"}
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-zinc-400">
            已完成 {interviewerTurns} 轮追问 · 建议 5-8 轮后生成报告
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  // 优先选 webm/opus,火山接受为 ogg_opus
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function MessageBubble({ message }: { message: UIMessage }) {
  const rawText = message.parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join("\n");
  const isInterviewer = message.role === "assistant";
  const { dimension, cleanContent } = isInterviewer
    ? extractDimension(rawText)
    : { dimension: null, cleanContent: rawText };

  return (
    <div className={`flex gap-3 ${isInterviewer ? "" : "flex-row-reverse"}`}>
      <Avatar role={message.role} />
      <div
        className={`max-w-[80%] ${isInterviewer ? "" : "items-end flex flex-col"}`}
      >
        {isInterviewer && dimension && DIM_LABEL[dimension] && (
          <span
            className={`inline-block text-[10px] tracking-wide uppercase font-medium rounded px-1.5 py-0.5 mb-1.5 ${DIM_COLOR[dimension] ?? ""}`}
          >
            追问·{DIM_LABEL[dimension]}
          </span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${
            isInterviewer
              ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              : "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          }`}
        >
          {cleanContent || (isInterviewer ? "…" : "")}
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: string }) {
  const isAi = role === "assistant";
  return (
    <div
      className={`shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs font-medium ${
        isAi
          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      }`}
    >
      {isAi ? "导师" : "我"}
    </div>
  );
}
