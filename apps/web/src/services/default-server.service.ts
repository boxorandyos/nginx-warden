import api from './api';
import type { ApiResponse } from '@/types';

export interface DefaultServerPayload {
  nginxConfig: string;
  indexHtml: string;
  paths: { nginx: string; indexHtml: string };
}

export const defaultServerService = {
  get: async (): Promise<ApiResponse<DefaultServerPayload>> => {
    const response = await api.get<ApiResponse<DefaultServerPayload>>('/system/default-server');
    return response.data;
  },

  update: async (body: {
    nginxConfig: string;
    indexHtml: string;
  }): Promise<ApiResponse<{ ok: boolean }>> => {
    const response = await api.put<ApiResponse<{ ok: boolean }>>('/system/default-server', body);
    return response.data;
  },
};
