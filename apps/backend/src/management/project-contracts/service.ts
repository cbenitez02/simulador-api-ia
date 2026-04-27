import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { authorizeProjectAccess, authorizeProjectCapability } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import { writeAuditEvent } from '../audit-events/service.js';
import { buildDefaultGlobalConfig } from '../global-config/defaults.js';
import type { UpsertEndpointConfigInput } from '../endpoint-config/schema.js';
import type { UpsertGlobalConfigInput } from '../global-config/schema.js';
import type { CreateScenarioInput } from '../scenarios/schema.js';
import type {
  ProjectContractAnalyzeResult,
  ProjectContractFormat,
  ProjectContractImportResult,
  ProjectContractMessage,
} from './schema.js';

type SupportedMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type EndpointConfigShape = UpsertEndpointConfigInput;
type GlobalConfigShape = UpsertGlobalConfigInput & { projectId: string };
type ScenarioShape = CreateScenarioInput;

type LiveProjectState = {
  id: string;
  name: string;
  slug: string;
  description: string;
  workspaceId: string | null;
  globalConfig: GlobalConfigShape | null;
  endpoints: LiveEndpointState[];
};

type LiveEndpointState = {
  id: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  endpointConfig: EndpointConfigShape | null;
  scenarios: ScenarioShape[];
};

type OpenApiOperationExtension = {
  endpointConfig?: Partial<EndpointConfigShape>;
  scenarios?: ScenarioShape[];
};

type OpenApiRootExtension = {
  globalConfig?: Partial<GlobalConfigShape>;
};

type ImportedOperation = {
  method: SupportedMethod;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  endpointConfig?: Partial<EndpointConfigShape>;
  scenarios?: ScenarioShape[];
  warnings: ProjectContractMessage[];
};

type ParsedOpenApiDocument = {
  document: OpenAPIV3.Document;
  format: ProjectContractFormat;
  title: string;
  version: string;
  rootExtension?: OpenApiRootExtension;
  operations: ImportedOperation[];
  warnings: ProjectContractMessage[];
};

type OpenApiExampleObject = Exclude<OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject, undefined>;

type AnalyzePlan = {
  parsed: ParsedOpenApiDocument;
  result: ProjectContractAnalyzeResult;
  create: ImportedOperation[];
  update: Array<{ imported: ImportedOperation; live: LiveEndpointState }>;
  delete: LiveEndpointState[];
  keep: Array<{ imported: ImportedOperation; live: LiveEndpointState }>;
};

const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export function buildProjectContractKey(method: string, path: string): string {
  return `${method.trim().toUpperCase()} ${path.trim()}`;
}

function isOpenApiExampleObject(value: unknown): value is OpenApiExampleObject {
  return typeof value === 'object' && value !== null;
}

function getOperationExtension(
  operation: OpenAPIV3.OperationObject
): OpenApiOperationExtension | undefined {
  const extension = (operation as Record<string, unknown>)['x-simulador-api-ia'];
  return typeof extension === 'object' && extension !== null
    ? (extension as OpenApiOperationExtension)
    : undefined;
}

function getRootExtension(document: OpenAPIV3.Document): OpenApiRootExtension | undefined {
  const extension = (document as unknown as Record<string, unknown>)['x-simulador-api-ia'];
  return typeof extension === 'object' && extension !== null
    ? (extension as OpenApiRootExtension)
    : undefined;
}

function getPathItemOperation(
  pathItem: OpenAPIV3.PathItemObject,
  method: SupportedMethod
): OpenAPIV3.OperationObject | OpenAPIV3.ReferenceObject | undefined {
  return (pathItem as Record<string, unknown>)[method.toLowerCase()] as
    | OpenAPIV3.OperationObject
    | OpenAPIV3.ReferenceObject
    | undefined;
}

function setPathItemOperation(
  pathItem: OpenAPIV3.PathItemObject,
  method: string,
  operation: OpenAPIV3.OperationObject
): void {
  (pathItem as Record<string, OpenAPIV3.OperationObject | undefined>)[method.toLowerCase()] =
    operation;
}

function normalizeEndpointConfig(
  config: Partial<EndpointConfigShape> | null | undefined
): EndpointConfigShape {
  return {
    latencyMode: config?.latencyMode === 'range' ? 'range' : 'fixed',
    fixedDelayMs: typeof config?.fixedDelayMs === 'number' ? config.fixedDelayMs : 0,
    minDelayMs: typeof config?.minDelayMs === 'number' ? config.minDelayMs : 0,
    maxDelayMs: typeof config?.maxDelayMs === 'number' ? config.maxDelayMs : 500,
    errorRate: 0,
    useScenarioWeights:
      typeof config?.useScenarioWeights === 'boolean' ? config.useScenarioWeights : true,
  };
}

function normalizeGlobalConfig(
  projectId: string,
  config: Partial<GlobalConfigShape> | null | undefined
): GlobalConfigShape {
  const defaults = buildDefaultGlobalConfig(projectId);
  return {
    projectId,
    latencyEnabled:
      typeof config?.latencyEnabled === 'boolean' ? config.latencyEnabled : defaults.latencyEnabled,
    latencyMinMs:
      typeof config?.latencyMinMs === 'number' ? config.latencyMinMs : defaults.latencyMinMs,
    latencyMaxMs:
      typeof config?.latencyMaxMs === 'number' ? config.latencyMaxMs : defaults.latencyMaxMs,
    latencyMode: config?.latencyMode === 'range' ? 'range' : 'fixed',
    errorSimulationEnabled:
      typeof config?.errorSimulationEnabled === 'boolean'
        ? config.errorSimulationEnabled
        : defaults.errorSimulationEnabled,
    errorSimulationRate:
      typeof config?.errorSimulationRate === 'number'
        ? config.errorSimulationRate
        : defaults.errorSimulationRate,
    errorSimulationCodes: Array.isArray(config?.errorSimulationCodes)
      ? config.errorSimulationCodes.filter((value): value is number => typeof value === 'number')
      : defaults.errorSimulationCodes,
    rateLimitingEnabled:
      typeof config?.rateLimitingEnabled === 'boolean'
        ? config.rateLimitingEnabled
        : defaults.rateLimitingEnabled,
    rateLimitingRpm:
      typeof config?.rateLimitingRpm === 'number'
        ? config.rateLimitingRpm
        : defaults.rateLimitingRpm,
    loggingLevel:
      config?.loggingLevel === 'full' || config?.loggingLevel === 'off'
        ? config.loggingLevel
        : 'basic',
    scope: config?.scope === 'unset' ? 'unset' : 'all',
  };
}

function normalizeScenarioList(
  scenarios: unknown,
  fallbackStatus: number,
  fallbackBody: unknown
): ScenarioShape[] {
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return [
      {
        name: 'Imported response',
        type: 'success',
        statusCode: fallbackStatus,
        body: fallbackBody,
        delayMs: 0,
        weight: 1,
      },
    ];
  }

  return scenarios.map((scenario, index) => {
    const item =
      typeof scenario === 'object' && scenario !== null
        ? (scenario as Record<string, unknown>)
        : {};
    return {
      name:
        typeof item['name'] === 'string' && item['name'].trim().length > 0
          ? item['name'].trim()
          : `Scenario ${index + 1}`,
      type:
        item['type'] === 'error' ||
        item['type'] === 'timeout' ||
        item['type'] === 'empty' ||
        item['type'] === 'unauthorized'
          ? item['type']
          : 'success',
      statusCode: typeof item['statusCode'] === 'number' ? item['statusCode'] : fallbackStatus,
      body: item['body'] ?? fallbackBody,
      delayMs: typeof item['delayMs'] === 'number' ? item['delayMs'] : 0,
      weight: typeof item['weight'] === 'number' && item['weight'] > 0 ? item['weight'] : 1,
    };
  });
}

function detectFormat(sourceText: string, sourceName?: string): ProjectContractFormat {
  const loweredName = sourceName?.toLowerCase() ?? '';
  if (loweredName.endsWith('.yaml') || loweredName.endsWith('.yml')) return 'yaml';
  const trimmed = sourceText.trim();
  return trimmed.startsWith('{') ? 'json' : 'yaml';
}

function assertNoExternalRefs(value: unknown, currentPath = ''): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoExternalRefs(item, `${currentPath}/${index}`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = `${currentPath}/${key}`;
    if (key === '$ref' && typeof nested === 'string' && !nested.startsWith('#/')) {
      throw new AppError(400, 'Contract uses unsupported external $ref', {
        code: 'OPENAPI_EXTERNAL_REF_UNSUPPORTED',
        details: [
          { code: 'external-ref', message: 'External $ref is not supported', path: nextPath },
        ],
      });
    }

    assertNoExternalRefs(nested, nextPath);
  }
}

function parseSourceText(sourceText: string, format: ProjectContractFormat): unknown {
  if (format === 'json') {
    return JSON.parse(sourceText);
  }

  return parseYaml(sourceText);
}

function extractOperationExample(operation: OpenAPIV3.OperationObject): {
  statusCode: number;
  responseBody: unknown;
  missingExample: boolean;
} {
  const responseEntries = Object.entries(operation.responses ?? {}).filter(
    (entry): entry is [string, OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject] => !!entry[1]
  );
  const successEntry = responseEntries.find(([status]) => /^2\d\d$/.test(status)) ??
    responseEntries.find(([status]) => status === 'default') ??
    responseEntries[0] ?? ['200', { description: 'Imported response' }];

  const [status, response] = successEntry;
  const statusCode = Number.parseInt(status, 10);
  const resolvedStatusCode = Number.isFinite(statusCode) ? statusCode : 200;

  if ('$ref' in response) {
    return { statusCode: resolvedStatusCode, responseBody: {}, missingExample: true };
  }

  const media = response.content?.['application/json'] ?? Object.values(response.content ?? {})[0];
  if (!media) {
    return { statusCode: resolvedStatusCode, responseBody: {}, missingExample: true };
  }

  if ('example' in media && media.example !== undefined) {
    return { statusCode: resolvedStatusCode, responseBody: media.example, missingExample: false };
  }

  const firstNamedExample = media.examples ? Object.values(media.examples)[0] : undefined;
  if (
    isOpenApiExampleObject(firstNamedExample) &&
    !('$ref' in firstNamedExample) &&
    firstNamedExample.value !== undefined
  ) {
    return {
      statusCode: resolvedStatusCode,
      responseBody: firstNamedExample.value,
      missingExample: false,
    };
  }

  return { statusCode: resolvedStatusCode, responseBody: {}, missingExample: true };
}

function toOperationWarnings(
  operation: OpenAPIV3.OperationObject,
  path: string,
  method: string
): ProjectContractMessage[] {
  const warnings: ProjectContractMessage[] = [];

  if ((operation.parameters?.length ?? 0) > 0) {
    warnings.push({
      code: 'unsupported-parameters',
      message: 'Parameters are ignored by the simulator import slice',
      path: `${method} ${path}`,
    });
  }

  if (operation.requestBody) {
    warnings.push({
      code: 'unsupported-request-body',
      message: 'Request body contracts are ignored by the simulator import slice',
      path: `${method} ${path}`,
    });
  }

  return warnings;
}

export async function parseProjectContractDocument(
  sourceText: string,
  sourceName?: string
): Promise<ParsedOpenApiDocument> {
  const format = detectFormat(sourceText, sourceName);
  let raw: unknown;

  try {
    raw = parseSourceText(sourceText, format);
  } catch (error) {
    throw new AppError(400, 'Contract is not valid JSON/YAML', {
      code: 'OPENAPI_PARSE_FAILED',
      details: [
        {
          code: 'parse-failed',
          message: error instanceof Error ? error.message : 'Unreadable document',
        },
      ],
    });
  }

  assertNoExternalRefs(raw);

  let validated: OpenAPIV3.Document;
  try {
    validated = (await SwaggerParser.validate(raw as OpenAPIV3.Document)) as OpenAPIV3.Document;
  } catch (error) {
    throw new AppError(400, 'Contract is not a valid OpenAPI document', {
      code: 'OPENAPI_INVALID',
      details: [
        {
          code: 'invalid-openapi',
          message: error instanceof Error ? error.message : 'Validation failed',
        },
      ],
    });
  }

  const warnings: ProjectContractMessage[] = [];
  const operations: ImportedOperation[] = [];

  for (const [path, pathItem] of Object.entries(validated.paths ?? {})) {
    if (!pathItem) continue;

    const typedPathItem = pathItem as OpenAPIV3.PathItemObject;

    for (const method of SUPPORTED_METHODS) {
      const operation = getPathItemOperation(typedPathItem, method);
      if (!operation || '$ref' in operation) continue;

      const example = extractOperationExample(operation);
      const operationWarnings = [...toOperationWarnings(operation, path, method)];
      if (example.missingExample) {
        operationWarnings.push({
          code: 'missing-example',
          message: 'Import falls back to safe placeholder examples when the contract omits them',
          path: `${method} ${path}`,
        });
      }

      const extension = getOperationExtension(operation);
      operations.push({
        method,
        path,
        description: operation.description ?? operation.summary ?? '',
        statusCode: example.statusCode,
        responseBody: example.responseBody,
        ...(extension?.endpointConfig !== undefined
          ? { endpointConfig: extension.endpointConfig }
          : {}),
        ...(extension?.scenarios !== undefined ? { scenarios: extension.scenarios } : {}),
        warnings: operationWarnings,
      });
      warnings.push(...operationWarnings);
    }

    for (const methodName of Object.keys(pathItem as Record<string, unknown>)) {
      if (
        !SUPPORTED_METHODS.includes(methodName.toUpperCase() as SupportedMethod) &&
        !['parameters', '$ref', 'summary', 'description', 'servers'].includes(methodName)
      ) {
        warnings.push({
          code: 'unsupported-method',
          message: `Method ${methodName.toUpperCase()} is ignored by the contract import slice`,
          path,
        });
      }
    }
  }

  const rootExtension = getRootExtension(validated);

  return {
    document: validated,
    format,
    title: validated.info?.title?.trim() || 'Imported contract',
    version: validated.info?.version?.trim() || '1.0.0',
    ...(rootExtension ? { rootExtension } : {}),
    operations,
    warnings,
  };
}

function toOpenApiResponse(responseBody: unknown): OpenAPIV3.ResponseObject {
  return {
    description: 'Simulator response',
    content: {
      'application/json': {
        example: responseBody,
      },
    },
  };
}

export function buildProjectContractDocument(project: LiveProjectState): {
  document: OpenAPIV3.Document;
  warnings: ProjectContractMessage[];
} {
  const paths: OpenAPIV3.PathsObject = {};
  const warnings: ProjectContractMessage[] = [];

  if (!project.globalConfig) {
    warnings.push({
      code: 'default-global-config',
      message:
        'Export injects default global config values when the project has no persisted global config',
      path: 'x-simulador-api-ia.globalConfig',
    });
  }

  for (const endpoint of [...project.endpoints].sort((left, right) =>
    buildProjectContractKey(left.method, left.path).localeCompare(
      buildProjectContractKey(right.method, right.path)
    )
  )) {
    if (!endpoint.endpointConfig) {
      warnings.push({
        code: 'default-endpoint-config',
        message:
          'Export injects default endpoint config values when the simulator has no persisted endpoint config',
        path: buildProjectContractKey(endpoint.method, endpoint.path),
      });
    }

    if (endpoint.scenarios.length === 0) {
      warnings.push({
        code: 'derived-scenarios',
        message:
          'Export derives a placeholder success scenario when the simulator only has the base endpoint response saved',
        path: buildProjectContractKey(endpoint.method, endpoint.path),
      });
    }

    const pathItem = (paths[endpoint.path] ?? {}) as OpenAPIV3.PathItemObject;
    const operation: OpenAPIV3.OperationObject & Record<string, unknown> = {
      ...(endpoint.description
        ? { summary: endpoint.description, description: endpoint.description }
        : {}),
      responses: {
        [String(endpoint.statusCode)]: toOpenApiResponse(endpoint.responseBody),
      },
    };
    operation['x-simulador-api-ia'] = {
      endpointConfig: normalizeEndpointConfig(endpoint.endpointConfig),
      scenarios: normalizeScenarioList(
        endpoint.scenarios,
        endpoint.statusCode,
        endpoint.responseBody
      ),
    };
    setPathItemOperation(pathItem, endpoint.method, operation);
    paths[endpoint.path] = pathItem;
  }

  const document: OpenAPIV3.Document & Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: project.name,
      version: '1.0.0',
      ...(project.description ? { description: project.description } : {}),
    },
    paths,
  };
  document['x-simulador-api-ia'] = {
    globalConfig: normalizeGlobalConfig(project.id, project.globalConfig),
  };

  return {
    document,
    warnings,
  };
}

export function serializeProjectContractDocument(
  document: OpenAPIV3.Document,
  format: ProjectContractFormat
): string {
  return format === 'yaml' ? stringifyYaml(document) : JSON.stringify(document, null, 2);
}

function buildAnalysisPlan(
  parsed: ParsedOpenApiDocument,
  liveProject: LiveProjectState
): AnalyzePlan {
  const liveByKey = new Map(
    liveProject.endpoints.map((endpoint) => [
      buildProjectContractKey(endpoint.method, endpoint.path),
      endpoint,
    ])
  );
  const importedByKey = new Map(
    parsed.operations.map((operation) => [
      buildProjectContractKey(operation.method, operation.path),
      operation,
    ])
  );

  const create = parsed.operations.filter(
    (operation) => !liveByKey.has(buildProjectContractKey(operation.method, operation.path))
  );
  const update: Array<{ imported: ImportedOperation; live: LiveEndpointState }> = [];
  const keep: Array<{ imported: ImportedOperation; live: LiveEndpointState }> = [];

  for (const operation of parsed.operations) {
    const live = liveByKey.get(buildProjectContractKey(operation.method, operation.path));
    if (!live) continue;

    const changed =
      live.description !== operation.description ||
      live.statusCode !== operation.statusCode ||
      JSON.stringify(live.responseBody) !== JSON.stringify(operation.responseBody) ||
      operation.endpointConfig !== undefined ||
      operation.scenarios !== undefined;

    (changed ? update : keep).push({ imported: operation, live });
  }

  const deleteOperations = liveProject.endpoints.filter(
    (endpoint) => !importedByKey.has(buildProjectContractKey(endpoint.method, endpoint.path))
  );

  const warnings = [...parsed.warnings];
  if (create.length > 0 && deleteOperations.length > 0) {
    warnings.push({
      code: 'rename-like-change',
      message: 'Path/method renames import as delete + create operations in the minimal slice',
    });
  }

  const operations = [
    ...parsed.operations.map((operation) => {
      const key = buildProjectContractKey(operation.method, operation.path);
      return {
        method: operation.method,
        path: operation.path,
        action: !liveByKey.has(key)
          ? 'create'
          : update.some(
                (entry) =>
                  buildProjectContractKey(entry.imported.method, entry.imported.path) === key
              )
            ? 'update'
            : 'keep',
        warnings: operation.warnings.map((warning) => warning.message),
      } as ProjectContractAnalyzeResult['operations'][number];
    }),
    ...deleteOperations.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      action: 'delete' as const,
      warnings: [],
    })),
  ].sort((left, right) =>
    buildProjectContractKey(left.method, left.path).localeCompare(
      buildProjectContractKey(right.method, right.path)
    )
  );

  return {
    parsed,
    create,
    update,
    delete: deleteOperations,
    keep,
    result: {
      document: {
        title: parsed.title,
        version: parsed.version,
        format: parsed.format,
      },
      summary: {
        create: create.length,
        update: update.length,
        delete: deleteOperations.length,
        warnings: warnings.length,
        errors: 0,
      },
      operations,
      warnings,
      errors: [],
    },
  };
}

async function loadLiveProjectState(projectId: string): Promise<LiveProjectState> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      globalConfig: true,
      endpoints: {
        include: {
          endpointConfig: true,
          scenarios: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ method: 'asc' }, { path: 'asc' }, { id: 'asc' }],
      },
    },
  });

  return project as unknown as LiveProjectState;
}

export async function exportProjectContract(
  actor: AuthenticatedActor,
  projectId: string,
  format: ProjectContractFormat
): Promise<{ body: string; filename: string; warnings: ProjectContractMessage[] }> {
  const access = await authorizeProjectAccess(actor, projectId, 'read');
  const project = await loadLiveProjectState(projectId);
  const exported = buildProjectContractDocument(project);
  const body = serializeProjectContractDocument(exported.document, format);

  await writeAuditEvent(prisma, {
    actor,
    workspaceId: access.workspaceId ?? '',
    projectId,
    resourceType: 'contract',
    resourceId: projectId,
    action: 'exported',
    summary: `Exported OpenAPI contract for ${project.name}`,
    metadata: {
      format,
      operationCount: project.endpoints.length,
      warningCount: exported.warnings.length,
      contractName: project.name,
    },
  });

  return {
    body,
    filename: `${project.slug}-openapi.${format === 'yaml' ? 'yaml' : 'json'}`,
    warnings: exported.warnings,
  };
}

export async function analyzeProjectContract(
  actor: AuthenticatedActor,
  projectId: string,
  sourceText: string,
  sourceName?: string
): Promise<ProjectContractAnalyzeResult> {
  const access = await authorizeProjectAccess(actor, projectId, 'read');
  const parsed = await parseProjectContractDocument(sourceText, sourceName);
  const liveProject = await loadLiveProjectState(projectId);
  const plan = buildAnalysisPlan(parsed, liveProject);

  await writeAuditEvent(prisma, {
    actor,
    workspaceId: access.workspaceId ?? '',
    projectId,
    resourceType: 'contract',
    resourceId: projectId,
    action: 'analyzed',
    summary: `Analyzed OpenAPI contract for ${liveProject.name}`,
    metadata: {
      format: parsed.format,
      create: plan.create.length,
      updated: plan.update.length,
      deleted: plan.delete.length,
      warningCount: plan.result.warnings.length,
      contractName: liveProject.name,
    },
  });

  return plan.result;
}

export async function importProjectContract(
  actor: AuthenticatedActor,
  projectId: string,
  sourceText: string,
  sourceName?: string
): Promise<ProjectContractImportResult> {
  const access = await authorizeProjectCapability(actor, projectId, 'canImportContracts');
  const parsed = await parseProjectContractDocument(sourceText, sourceName);
  const liveProject = await loadLiveProjectState(projectId);
  const plan = buildAnalysisPlan(parsed, liveProject);

  await prisma.$transaction(async (tx) => {
    const globalConfigOverride = parsed.rootExtension?.globalConfig;
    if (globalConfigOverride) {
      const normalizedGlobal = normalizeGlobalConfig(projectId, globalConfigOverride);
      await tx.globalConfig.upsert({
        where: { projectId },
        update: {
          latencyEnabled: normalizedGlobal.latencyEnabled,
          latencyMinMs: normalizedGlobal.latencyMinMs,
          latencyMaxMs: normalizedGlobal.latencyMaxMs,
          latencyMode: normalizedGlobal.latencyMode,
          errorSimulationEnabled: normalizedGlobal.errorSimulationEnabled,
          errorSimulationRate: normalizedGlobal.errorSimulationRate,
          errorSimulationCodes: toPrismaJson(normalizedGlobal.errorSimulationCodes),
          rateLimitingEnabled: normalizedGlobal.rateLimitingEnabled,
          rateLimitingRpm: normalizedGlobal.rateLimitingRpm,
          loggingLevel: normalizedGlobal.loggingLevel,
          scope: normalizedGlobal.scope,
        },
        create: {
          projectId,
          latencyEnabled: normalizedGlobal.latencyEnabled,
          latencyMinMs: normalizedGlobal.latencyMinMs,
          latencyMaxMs: normalizedGlobal.latencyMaxMs,
          latencyMode: normalizedGlobal.latencyMode,
          errorSimulationEnabled: normalizedGlobal.errorSimulationEnabled,
          errorSimulationRate: normalizedGlobal.errorSimulationRate,
          errorSimulationCodes: toPrismaJson(normalizedGlobal.errorSimulationCodes),
          rateLimitingEnabled: normalizedGlobal.rateLimitingEnabled,
          rateLimitingRpm: normalizedGlobal.rateLimitingRpm,
          loggingLevel: normalizedGlobal.loggingLevel,
          scope: normalizedGlobal.scope,
        },
      });
    }

    for (const deletion of plan.delete) {
      await tx.endpoint.delete({ where: { id: deletion.id } });
    }

    for (const created of plan.create) {
      const endpoint = await tx.endpoint.create({
        data: {
          projectId,
          method: created.method,
          path: created.path,
          description: created.description,
          statusCode: created.statusCode,
          responseBody: toPrismaJson(created.responseBody),
        },
      });

      await tx.endpointConfig.create({
        data: {
          endpointId: endpoint.id,
          ...normalizeEndpointConfig(created.endpointConfig),
        },
      });

      await tx.scenario.createMany({
        data: normalizeScenarioList(
          created.scenarios,
          created.statusCode,
          created.responseBody
        ).map((scenario) => ({
          endpointId: endpoint.id,
          name: scenario.name,
          type: scenario.type,
          statusCode: scenario.statusCode,
          body: toPrismaJson(scenario.body),
          delayMs: scenario.delayMs,
          weight: scenario.weight,
        })),
      });
    }

    for (const updated of plan.update) {
      await tx.endpoint.update({
        where: { id: updated.live.id },
        data: {
          description: updated.imported.description,
          statusCode: updated.imported.statusCode,
          responseBody: toPrismaJson(
            updated.imported.responseBody ?? updated.live.responseBody ?? {}
          ),
        },
      });

      if (updated.imported.endpointConfig) {
        await tx.endpointConfig.upsert({
          where: { endpointId: updated.live.id },
          update: normalizeEndpointConfig({
            ...normalizeEndpointConfig(updated.live.endpointConfig),
            ...updated.imported.endpointConfig,
          }),
          create: {
            endpointId: updated.live.id,
            ...normalizeEndpointConfig(updated.imported.endpointConfig),
          },
        });
      }

      if (updated.imported.scenarios) {
        await tx.scenario.deleteMany({ where: { endpointId: updated.live.id } });
        await tx.scenario.createMany({
          data: normalizeScenarioList(
            updated.imported.scenarios,
            updated.imported.statusCode,
            updated.imported.responseBody
          ).map((scenario) => ({
            endpointId: updated.live.id,
            name: scenario.name,
            type: scenario.type,
            statusCode: scenario.statusCode,
            body: toPrismaJson(scenario.body),
            delayMs: scenario.delayMs,
            weight: scenario.weight,
          })),
        });
      }
    }

    await writeAuditEvent(tx, {
      actor,
      workspaceId: access.workspaceId ?? '',
      projectId,
      resourceType: 'contract',
      resourceId: projectId,
      action: 'imported',
      summary: `Imported OpenAPI contract into ${liveProject.name}`,
      metadata: {
        created: plan.create.length,
        updated: plan.update.length,
        deleted: plan.delete.length,
        warningCount: plan.result.warnings.length,
        contractName: liveProject.name,
      },
    });
  });

  return {
    ...plan.result,
    committed: {
      created: plan.create.length,
      updated: plan.update.length,
      deleted: plan.delete.length,
    },
  };
}
