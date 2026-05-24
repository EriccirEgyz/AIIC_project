import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { mainModel, mainModelId } from "@/lib/llm";
import { prisma } from "@/lib/db";
import {
  buildInterviewerSystemPrompt,
  extractDimension,
} from "@/lib/prompts/interviewer";
import { recordUsage } from "@/lib/usage";

type Body = { messages: UIMessage[]; sessionId: string };

function uiMessageText(m: UIMessage): string {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  const { messages, sessionId } = (await req.json()) as Body;
  if (!sessionId) {
    return Response.json({ error: "missing_sessionId" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return Response.json({ error: "session_not_found" }, { status: 404 });
  }

  const interviewerTurnCount = await prisma.turn.count({
    where: { sessionId, role: "interviewer" },
  });

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const text = uiMessageText(lastUser);
    if (text) {
      const existing = await prisma.turn.findFirst({
        where: { sessionId, role: "candidate", content: text },
        orderBy: { createdAt: "desc" },
      });
      if (!existing) {
        await prisma.turn.create({
          data: { sessionId, role: "candidate", content: text },
        });
      }
    }
  }

  const system = buildInterviewerSystemPrompt({
    field: session.field,
    experience: session.experience,
    turnIndex: interviewerTurnCount,
  });

  const model = mainModelId();
  const result = streamText({
    model: mainModel(),
    system,
    messages: await convertToModelMessages(messages),
    temperature: 0.7,
    onFinish: async (event) => {
      try {
        const { dimension, cleanContent } = extractDimension(event.text);
        await prisma.turn.create({
          data: {
            sessionId,
            role: "interviewer",
            content: cleanContent,
            dimension,
          },
        });
        await recordUsage({
          endpoint: "chat",
          model,
          promptTokens: event.totalUsage.inputTokens ?? 0,
          completionTokens: event.totalUsage.outputTokens ?? 0,
          sessionId,
        });
      } catch (e) {
        console.error("chat onFinish persist failed:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
