import { transcribe, type AudioFormat } from "@/lib/volc-asr";
import { recordUsage } from "@/lib/usage";

/**
 * POST /api/transcribe
 *   multipart/form-data:
 *     - audio: Blob (the recorded audio file)
 *     - format: optional string ("wav" | "mp3" | "ogg_opus"), default inferred
 *   OR
 *   application/json:
 *     - { audio: base64String, format: "wav" }
 *
 *   Returns: { text: string, durationMs: number }
 *
 * 接受浏览器 MediaRecorder 输出(默认 webm/opus, 我们 hint "ogg_opus" 给火山)。
 */
export async function POST(req: Request) {
  let audio: Buffer | null = null;
  let format: AudioFormat = "ogg_opus";

  const ct = req.headers.get("content-type") ?? "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) {
        return Response.json(
          { error: "missing_audio_field" },
          { status: 400 },
        );
      }
      const fmt = form.get("format");
      if (typeof fmt === "string") format = fmt as AudioFormat;
      else format = inferFormatFromMime(file.type);
      audio = Buffer.from(await file.arrayBuffer());
    } else {
      // JSON path
      const body = (await req.json()) as { audio?: string; format?: string };
      if (!body.audio) {
        return Response.json(
          { error: "missing_audio_field" },
          { status: 400 },
        );
      }
      if (body.format) format = body.format as AudioFormat;
      audio = Buffer.from(body.audio, "base64");
    }
  } catch (e) {
    return Response.json(
      { error: "parse_error", message: (e as Error).message },
      { status: 400 },
    );
  }

  if (!audio || audio.length === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  // 防呆: 最大 25MB (够 30+ 分钟说话, 远超单轮回答需求)
  if (audio.length > 25 * 1024 * 1024) {
    return Response.json({ error: "audio_too_large" }, { status: 413 });
  }

  try {
    const result = await transcribe({ audio, format });
    // 试用版免费,cost 记 0;但记 token 数(我们不知道,记字符数)用于监控调用频率
    await recordUsage({
      endpoint: "chat", // 复用现有枚举,实际是 ASR -> 后续 prompt 用. 标在 model 字段区分
      model: `volc-asr-flash/${format}`,
      promptTokens: 0,
      completionTokens: result.text.length,
      ok: true,
    });
    return Response.json({ text: result.text, durationMs: result.durationMs });
  } catch (err) {
    await recordUsage({
      endpoint: "chat",
      model: `volc-asr-flash/${format}`,
      promptTokens: 0,
      completionTokens: 0,
      ok: false,
      errorMessage: (err as Error).message,
    });
    return Response.json(
      { error: "asr_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function inferFormatFromMime(mime: string): AudioFormat {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("webm") || mime.includes("ogg") || mime.includes("opus"))
    return "ogg_opus";
  return "ogg_opus";
}
