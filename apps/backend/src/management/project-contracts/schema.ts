import { z } from 'zod';

export const projectContractParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const projectContractFormatSchema = z.enum(['json', 'yaml']).default('json');

export const projectContractFormatQuerySchema = z.object({
  format: projectContractFormatSchema.default('json'),
});

export const projectContractMessageSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1).optional(),
});

export const projectContractOperationActionSchema = z.enum(['create', 'update', 'delete', 'keep']);

export const projectContractOperationResultSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  action: projectContractOperationActionSchema,
  warnings: z.array(z.string()).default([]),
});

export const projectContractAnalyzeResultSchema = z.object({
  document: z.object({
    title: z.string().min(1),
    version: z.string().min(1),
    format: projectContractFormatSchema,
  }),
  summary: z.object({
    create: z.number().int().min(0),
    update: z.number().int().min(0),
    delete: z.number().int().min(0),
    warnings: z.number().int().min(0),
    errors: z.number().int().min(0),
  }),
  operations: z.array(projectContractOperationResultSchema),
  warnings: z.array(projectContractMessageSchema),
  errors: z.array(projectContractMessageSchema),
});

export const projectContractImportResultSchema = projectContractAnalyzeResultSchema.extend({
  committed: z.object({
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    deleted: z.number().int().min(0),
  }),
});

export type ProjectContractFormat = z.infer<typeof projectContractFormatSchema>;
export type ProjectContractMessage = z.infer<typeof projectContractMessageSchema>;
export type ProjectContractAnalyzeResult = z.infer<typeof projectContractAnalyzeResultSchema>;
export type ProjectContractImportResult = z.infer<typeof projectContractImportResultSchema>;
