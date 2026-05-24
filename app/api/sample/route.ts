import { generateText } from "ai";
import { z } from "zod";
import { liteModel, liteModelId } from "@/lib/llm";
import { SAMPLE_SYSTEM_PROMPT, buildSampleUserPrompt } from "@/lib/prompts/sample";
import { recordUsage } from "@/lib/usage";

const Body = z.object({
  field: z.string().min(1).max(60).default("计算机视觉"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const model = liteModelId();
  try {
    const { text, usage } = await generateText({
      model: liteModel(),
      system: SAMPLE_SYSTEM_PROMPT,
      prompt: buildSampleUserPrompt(parsed.data.field),
      temperature: 0.9,
    });
    await recordUsage({
      endpoint: "sample",
      model,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
    });
    return Response.json({ experience: text.trim() });
  } catch (err) {
    await recordUsage({
      endpoint: "sample",
      model,
      promptTokens: 0,
      completionTokens: 0,
      ok: false,
      errorMessage: (err as Error).message,
    });
    return Response.json(
      { error: "llm_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
