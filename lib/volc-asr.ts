/**
 * 火山引擎大模型录音文件识别 - 极速版 (flash, 同步)
 * https://www.volcengine.com/docs/6561/1631584
 *
 * 选用极速版而非标准版的理由:
 *  - 同步返回(单 HTTP, 无需 submit+query 轮询)
 *  - 支持 base64 audio data, 不需要把音频先上传到公网 URL
 *  - 16h 挑战下大幅减少代码量和故障点
 *
 * 鉴权: 用旧版控制台 header 三件套(X-Api-App-Key + X-Api-Access-Key + X-Api-Resource-Id)。
 * 新版控制台用单 X-Api-Key, 我们这个 key 是旧版控制台创建的所以走旧版。
 */

import { randomUUID } from "node:crypto";

const FLASH_URL =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";

export type AudioFormat = "wav" | "mp3" | "ogg_opus" | "pcm";

export type TranscribeResult = {
  text: string;
  durationMs: number;
  requestId: string;
};

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function transcribe(opts: {
  /** Raw audio bytes (will be base64-encoded for the request). */
  audio: Buffer;
  /** Audio container/codec hint sent to Volcano. */
  format: AudioFormat;
}): Promise<TranscribeResult> {
  const appId = envOrThrow("VOLC_APP_ID");
  const token = envOrThrow("VOLC_ACCESS_TOKEN");
  const resourceId =
    process.env.VOLC_ASR_RESOURCE_ID ?? "volc.bigasr.auc_turbo";

  const requestId = randomUUID();
  const body = {
    user: { uid: appId },
    audio: {
      data: opts.audio.toString("base64"),
      format: opts.format,
    },
    request: { model_name: "bigmodel" },
  };

  const t0 = Date.now();
  const res = await fetch(FLASH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-App-Key": appId,
      "X-Api-Access-Key": token,
      "X-Api-Resource-Id": resourceId,
      "X-Api-Request-Id": requestId,
      "X-Api-Sequence": "-1",
    },
    body: JSON.stringify(body),
  });

  const durationMs = Date.now() - t0;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Volcano ASR HTTP ${res.status}: ${errText.slice(0, 400)}`,
    );
  }

  // 火山约定: HTTP 200 不代表业务成功;真正的状态在响应 header X-Api-Status-Code
  // 或响应 body 的 code 字段。需要校验。
  const json = (await res.json().catch(() => null)) as
    | { result?: { text?: string }; message?: string; code?: number }
    | null;

  if (!json || typeof json !== "object") {
    throw new Error(`Volcano ASR: empty or non-JSON response`);
  }

  const text = json.result?.text ?? "";
  if (!text && json.code && json.code !== 0) {
    throw new Error(
      `Volcano ASR business error code=${json.code} message=${json.message ?? "?"}`,
    );
  }

  return { text, durationMs, requestId };
}
