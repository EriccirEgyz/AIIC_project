import { createOpenAI } from "@ai-sdk/openai";

type Provider = "openrouter" | "deepseek" | "qwen";

type ProviderConfig = {
  baseURL: string;
  apiKeyEnv: string;
  mainEnv: string;
  liteEnv: string;
  mainDefault: string;
  liteDefault: string;
  headers?: Record<string, string>;
};

const CONFIGS: Record<Provider, ProviderConfig> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    mainEnv: "OPENROUTER_MAIN_MODEL",
    liteEnv: "OPENROUTER_LITE_MODEL",
    mainDefault: "anthropic/claude-sonnet-4.6",
    liteDefault: "anthropic/claude-haiku-4.5",
    headers: {
      // OpenRouter requires HTTP-Referer for analytics/free-tier routing
      "HTTP-Referer": "https://github.com/aiic-mock-interview",
      "X-Title": "AI 保研复试·科研经历深挖",
    },
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    mainEnv: "DEEPSEEK_MAIN_MODEL",
    liteEnv: "DEEPSEEK_MAIN_MODEL",
    mainDefault: "deepseek-chat",
    liteDefault: "deepseek-chat",
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "QWEN_API_KEY",
    mainEnv: "QWEN_MAIN_MODEL",
    liteEnv: "QWEN_MAIN_MODEL",
    mainDefault: "qwen-plus",
    liteDefault: "qwen-turbo",
  },
};

function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();
  if (p === "openrouter" || p === "deepseek" || p === "qwen") return p;
  throw new Error(`Unsupported LLM_PROVIDER: ${p}`);
}

function buildClient() {
  const provider = getProvider();
  const cfg = CONFIGS[provider];
  const apiKey = process.env[cfg.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `Missing ${cfg.apiKeyEnv}. Set it in .env.local (provider=${provider}).`,
    );
  }
  return {
    provider,
    cfg,
    client: createOpenAI({
      apiKey,
      baseURL: cfg.baseURL,
      headers: cfg.headers,
    }),
  };
}

// Lazy-cached, so tests / dev hot-reload don't rebuild on every call.
let cached: ReturnType<typeof buildClient> | null = null;
function getClient() {
  if (!cached) cached = buildClient();
  return cached;
}

/** Heavy reasoning: interviewer follow-up, report synthesis. */
export function mainModel() {
  const { cfg, client } = getClient();
  return client(process.env[cfg.mainEnv] ?? cfg.mainDefault);
}

/** Cheap/fast: sample experience generation, dimension classification. */
export function liteModel() {
  const { cfg, client } = getClient();
  return client(process.env[cfg.liteEnv] ?? cfg.liteDefault);
}

export function currentProvider(): Provider {
  return getClient().provider;
}
