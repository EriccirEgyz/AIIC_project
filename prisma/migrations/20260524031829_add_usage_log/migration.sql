-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costMicros" INTEGER NOT NULL,
    "sessionId" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_endpoint_createdAt_idx" ON "UsageLog"("endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_sessionId_idx" ON "UsageLog"("sessionId");
