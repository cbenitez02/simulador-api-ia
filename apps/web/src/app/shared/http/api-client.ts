import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { mapApiError, type ApiError } from './api-error.mapper';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string): Promise<T> {
    return this.request(() => firstValueFrom(this.http.get<T>(this.url(path))));
  }

  post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request(() => firstValueFrom(this.http.post<TResponse>(this.url(path), body)));
  }

  patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request(() => firstValueFrom(this.http.patch<TResponse>(this.url(path), body)));
  }

  put<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request(() => firstValueFrom(this.http.put<TResponse>(this.url(path), body)));
  }

  delete(path: string): Promise<void> {
    return this.request(async () => {
      await firstValueFrom(this.http.delete(this.url(path)));
    });
  }

  private async request<T>(executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): ApiError {
    if (error instanceof HttpErrorResponse) {
      return mapApiError(error);
    }

    return mapApiError(error);
  }

  private url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }
}
