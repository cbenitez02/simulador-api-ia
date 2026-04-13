CREATE TABLE "RuntimeRateLimitBucket" (
    "projectId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeRateLimitBucket_pkey" PRIMARY KEY ("projectId","windowStart")
);

CREATE INDEX "RuntimeRateLimitBucket_windowStart_idx" ON "RuntimeRateLimitBucket"("windowStart");

ALTER TABLE "RuntimeRateLimitBucket" ADD CONSTRAINT "RuntimeRateLimitBucket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
