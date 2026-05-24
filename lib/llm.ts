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
      // OpenRouter optional headers — must be ASCII (Latin-1) per HTTP spec.
      "HTTP-Referer": "https://github.com/EriccirEgyz/AIIC_project",
      "X-Title": "AIIC Mock Interview",
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

/**
 * OpenRouter 路由控制:从中国大陆调用时,默认路由会撞到 OpenAI 直连(被 CN 区拦)。
 * 通过 body 里 provider.order 字段强制走 Azure(微软托管的 OpenAI,国内可达)。
 *
 * 通过逗号分隔的 OPENROUTER_PROVIDER_ORDER 自定义优先级,例如:
 *   OPENROUTER_PROVIDER_ORDER="Azure,Fireworks"
 */
function makeOpenRouterFetch(): typeof fetch {
  const orderRaw = process.env.OPENROUTER_PROVIDER_ORDER ?? "";
  const order = orderRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return async (input, init) => {
    if (init?.body && typeof init.body === "string" && order.length > 0) {
      try {
        const parsed = JSON.parse(init.body);
        parsed.provider = {
          order,
          allow_fallbacks: false,
          ...(parsed.provider ?? {}),
        };
        init = { ...init, body: JSON.stringify(parsed) };
      } catch {
        // Not JSON body — leave untouched.
      }
    }
    return fetch(input, init);
  };
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
      fetch: provider === "openrouter" ? makeOpenRouterFetch() : undefined,
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
  const { client } = getClient();
  // Force chat-completions API; the default Responses API (input:) is not
  // supported by Azure-hosted OpenAI, which is the only route reachable
  // from mainland CN via OpenRouter.
  return client.chat(mainModelId());
}

/** Cheap/fast: sample experience generation, dimension classification. */
export function liteModel() {
  const { client } = getClient();
  return client.chat(liteModelId());
}

export function mainModelId(): string {
  const { cfg } = getClient();
  return process.env[cfg.mainEnv] ?? cfg.mainDefault;
}

export function liteModelId(): string {
  const { cfg } = getClient();
  return process.env[cfg.liteEnv] ?? cfg.liteDefault;
}

export function currentProvider(): Provider {
  return getClient().provider;
}
