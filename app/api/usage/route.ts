import { prisma } from "@/lib/db";
import { microsToUsd } from "@/lib/usage";

/**
 * GET /api/usage  - 当前总花销 + 按端点细分
 * GET /api/usage?sessionId=xxx  - 单会话花销
 *
 * 用于:
 *  - 调试时实时监控成本
 *  - UI 角落显示"已花费 $X.XX"
 *  - 报销分析
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  const where = sessionId ? { sessionId } : {};
  const logs = await prisma.usageLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const totals = logs.reduce(
    (acc, l) => {
      acc.calls += 1;
      acc.promptTokens += l.promptTokens;
      acc.completionTokens += l.completionTokens;
      acc.costMicros += l.costMicros;
      acc.byEndpoint[l.endpoint] ??= {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        costMicros: 0,
      };
      const e = acc.byEndpoint[l.endpoint];
      e.calls += 1;
      e.promptTokens += l.promptTokens;
      e.completionTokens += l.completionTokens;
      e.costMicros += l.costMicros;
      return acc;
    },
    {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 0,
      byEndpoint: {} as Record<
        string,
        {
          calls: number;
          promptTokens: number;
          completionTokens: number;
          costMicros: number;
        }
      >,
    },
  );

  return Response.json({
    scope: sessionId ? { sessionId } : "global",
    totals: {
      calls: totals.calls,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      costUsd: microsToUsd(totals.costMicros),
    },
    byEndpoint: Object.fromEntries(
      Object.entries(totals.byEndpoint).map(([k, v]) => [
        k,
        {
          calls: v.calls,
          promptTokens: v.promptTokens,
          completionTokens: v.completionTokens,
          costUsd: microsToUsd(v.costMicros),
        },
      ]),
    ),
    recent: logs.slice(0, 20).map((l) => ({
      endpoint: l.endpoint,
      model: l.model,
      tokens: { in: l.promptTokens, out: l.completionTokens },
      costUsd: microsToUsd(l.costMicros),
      ok: l.ok,
      error: l.errorMessage,
      sessionId: l.sessionId,
      at: l.createdAt.toISOString(),
    })),
  });
}
