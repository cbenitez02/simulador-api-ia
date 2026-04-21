import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../shared/http/api-client';
import type {
  OpenApiContractAnalyzeDto,
  OpenApiContractFormatDto,
  OpenApiContractImportDto,
  OpenApiContractMessageDto,
} from '../../../shared/http/api.types';

export interface ProjectContractExportResult {
  text: string;
  filename: string;
  contentType: string;
  warnings: OpenApiContractMessageDto[];
}

@Injectable({ providedIn: 'root' })
export class ProjectContractsRepository {
  private readonly api = inject(ApiClient);

  async exportContract(
    projectId: string,
    format: OpenApiContractFormatDto = 'json',
  ): Promise<ProjectContractExportResult> {
    const response = await this.api.getTextResponse(`/projects/${projectId}/openapi?format=${format}`);
    const disposition = response.headers['content-disposition'] ?? '';
    const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
    const warningHeader = response.headers['x-simulador-contract-warnings'];

    return {
      text: response.body,
      filename: filenameMatch?.[1] ?? `contract.${format}`,
      contentType: response.headers['content-type'] ?? 'application/json',
      warnings: warningHeader ? (JSON.parse(decodeURIComponent(warningHeader)) as OpenApiContractMessageDto[]) : [],
    };
  }

  analyzeContract(projectId: string, file: File): Promise<OpenApiContractAnalyzeDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm<OpenApiContractAnalyzeDto>(`/projects/${projectId}/openapi/analyze`, formData);
  }

  importContract(projectId: string, file: File): Promise<OpenApiContractImportDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm<OpenApiContractImportDto>(`/projects/${projectId}/openapi/import`, formData);
  }
}
