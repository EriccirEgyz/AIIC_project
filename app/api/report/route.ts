import { generateObject } from "ai";
import { z } from "zod";
import { mainModel, mainModelId } from "@/lib/llm";
import { prisma } from "@/lib/db";
import { REPORT_SYSTEM_PROMPT, buildReportUserPrompt } from "@/lib/prompts/report";
import { recordUsage } from "@/lib/usage";

const Body = z.object({ sessionId: z.string().min(1) });

const ReportSchema = z.object({
  scores: z.object({
    motivation: z.number().min(0).max(10),
    method: z.number().min(0).max(10),
    data: z.number().min(0).max(10),
    failure: z.number().min(0).max(10),
    reflection: z.number().min(0).max(10),
  }),
  overall: z.number().min(0).max(10),
  strengths: z.array(z.string()).max(6),
  weaknesses: z.array(z.string()).max(4),
  improvements: z
    .array(
      z.object({
        issue: z.string(),
        suggestion: z.string(),
        exampleAnswer: z.string(),
      }),
    )
    .max(5),
  redFlags: z.array(z.string()).max(4),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const { sessionId } = parsed.data;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { turns: { orderBy: { createdAt: "asc" } }, report: true },
  });
  if (!session) {
    return Response.json({ error: "session_not_found" }, { status: 404 });
  }

  if (session.report) {
    return Response.json({
      report: JSON.parse(session.report.scoresJson),
      cached: true,
    });
  }

  if (session.turns.length < 4) {
    return Response.json(
      { error: "too_few_turns", message: "至少完成 2 轮问答才能生成报告" },
      { status: 400 },
    );
  }

  const model = mainModelId();
  try {
    const { object, usage } = await generateObject({
      model: mainModel(),
      system: REPORT_SYSTEM_PROMPT,
      prompt: buildReportUserPrompt({
        experience: session.experience,
        transcript: session.turns,
      }),
      schema: ReportSchema,
      temperature: 0.3,
    });

    await prisma.report.create({
      data: {
        sessionId,
        scoresJson: JSON.stringify(object),
        feedback: "",
      },
    });

    await recordUsage({
      endpoint: "report",
      model,
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      sessionId,
    });

    return Response.json({ report: object });
  } catch (err) {
    await recordUsage({
      endpoint: "report",
      model,
      promptTokens: 0,
      completionTokens: 0,
      sessionId,
      ok: false,
      errorMessage: (err as Error).message,
    });
    return Response.json(
      { error: "llm_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
