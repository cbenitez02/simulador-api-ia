-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "responseBody" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "delayMs" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointConfig" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "latencyMode" TEXT NOT NULL DEFAULT 'fixed',
    "fixedDelayMs" INTEGER NOT NULL DEFAULT 0,
    "minDelayMs" INTEGER NOT NULL DEFAULT 0,
    "maxDelayMs" INTEGER NOT NULL DEFAULT 500,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "useScenarioWeights" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndpointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "latencyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "latencyMinMs" INTEGER NOT NULL DEFAULT 0,
    "latencyMaxMs" INTEGER NOT NULL DEFAULT 1000,
    "latencyMode" TEXT NOT NULL DEFAULT 'fixed',
    "errorSimulationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "errorSimulationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorSimulationCodes" JSONB NOT NULL DEFAULT '[500]'::jsonb,
    "rateLimitingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitingRpm" INTEGER NOT NULL DEFAULT 60,
    "loggingLevel" TEXT NOT NULL DEFAULT 'basic',
    "scope" TEXT NOT NULL DEFAULT 'all',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fullUrl" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "scenarioSelectionSource" TEXT NOT NULL,
    "requestHeaders" JSONB NOT NULL,
    "requestBody" JSONB,
    "responseHeaders" JSONB NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_projectId_method_path_key" ON "Endpoint"("projectId", "method", "path");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointConfig_endpointId_key" ON "EndpointConfig"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalConfig_projectId_key" ON "GlobalConfig"("projectId");

-- CreateIndex
CREATE INDEX "ApiLog_projectId_createdAt_idx" ON "ApiLog"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointConfig" ADD CONSTRAINT "EndpointConfig_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalConfig" ADD CONSTRAINT "GlobalConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
