import { prisma } from "@/lib/db";

/**
 * Per-MTok prices in USD, for OpenRouter model ids.
 * Cross-referenced from https://openrouter.ai/api/v1/models on 2026-05-24.
 * Keep in sync when switching models.
 */
const PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "qwen/qwen3-max": { in: 0.78, out: 3.9 },
  "qwen/qwen3-vl-235b-a22b-thinking": { in: 0.26, out: 2.6 },
  "qwen/qwen-turbo": { in: 0.05, out: 0.2 },
  "deepseek/deepseek-v3.2": { in: 0.252, out: 0.378 },
  "deepseek/deepseek-v4-flash": { in: 0.1, out: 0.2 },
  "anthropic/claude-sonnet-4.6": { in: 3, out: 15 },
  "anthropic/claude-haiku-4.5": { in: 1, out: 5 },
  "meta-llama/llama-3.3-70b-instruct": { in: 0.1, out: 0.32 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-20b": { in: 0.03, out: 0.14 },
  "openai/gpt-5-nano": { in: 0.05, out: 0.4 },
  "qwen/qwen-plus-2025-07-28": { in: 0.26, out: 0.78 },
  "qwen/qwen3.6-plus": { in: 0.325, out: 1.95 },
  "qwen/qwen3-coder-30b-a3b-instruct": { in: 0.07, out: 0.27 },
  "mistralai/mistral-small-3.2-24b-instruct": { in: 0.075, out: 0.2 },
};

export function estimateCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0; // unknown model -> cost未知, 至少 token 还能看
  const usd =
    (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out;
  return Math.round(usd * 1_000_000); // micro-USD, integer for SQLite
}

export type Endpoint = "sample" | "session_open" | "chat" | "report";

type LogArgs = {
  endpoint: Endpoint;
  model: string;
  promptTokens: number;
  completionTokens: number;
  sessionId?: string | null;
  ok?: boolean;
  errorMessage?: string | null;
};

export async function recordUsage(args: LogArgs): Promise<void> {
  try {
    const total = args.promptTokens + args.completionTokens;
    await prisma.usageLog.create({
      data: {
        endpoint: args.endpoint,
        model: args.model,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        totalTokens: total,
        costMicros: estimateCostMicros(
          args.model,
          args.promptTokens,
          args.completionTokens,
        ),
        sessionId: args.sessionId ?? null,
        ok: args.ok ?? true,
        errorMessage: args.errorMessage ?? null,
      },
    });
  } catch (e) {
    // 监控错误不该挂掉用户请求
    console.error("recordUsage failed:", e);
  }
}

export function microsToUsd(micros: number): string {
  return (micros / 1_000_000).toFixed(4);
}
