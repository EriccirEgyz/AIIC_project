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

export default function InterviewChat({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex-1 flex flex-col">
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

      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto w-full px-6 py-4">
          {reportError && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">
              ⚠ {reportError}
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
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
                isBusy ? "导师还在说话…" : "Enter 发送 · Shift+Enter 换行"
              }
              disabled={isBusy}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50"
            />
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
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
    </div>
  );
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
