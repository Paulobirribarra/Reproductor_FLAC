import axios from 'axios';
import type { FileInfo, ApiResponse } from '../types/index';

const api = axios.create({
  baseURL: '/api',
});

export const filesApi = {
  uploadFile: (file: File, folder?: string) => {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);

    const queryString = params.toString();
    const url = queryString ? `/files/upload?${queryString}` : '/files/upload';

    return api.post<ApiResponse<FileInfo>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listFiles: (folder?: string) => {
    return api.get<ApiResponse<{ files: FileInfo[]; folders: any[] }>>('/files', {
      params: { folder: folder || '' },
    });
  },

  deleteFile: (fileName: string, folder?: string) => {
    return api.delete<ApiResponse>(`/files/${encodeURIComponent(fileName)}`, {
      params: { folder: folder || '' },
    });
  },

  renameFile: (fileName: string, newName: string, folder?: string) => {
    return api.patch<ApiResponse>(`/files/${encodeURIComponent(fileName)}/rename`,
      { newName },
      { params: { folder: folder || '' } }
    );
  },

  createFolder: (folderName: string, parentFolder?: string) => {
    return api.post<ApiResponse>('/files/folders', {
      folderName,
      parentFolder: parentFolder || '',
    });
  },

  deleteFolder: (folderPath: string) => {
    const encodedPath = encodeURIComponent(folderPath);
    return api.delete<ApiResponse>(`/files/folders/${encodedPath}`);
  },

  moveFile: (fileName: string, fromFolder: string, toFolder: string) => {
    return api.post<ApiResponse>('/files/move', {
      fileName,
      fromFolder,
      toFolder,
    });
  },

  getFileStream: (fileName: string, folder?: string) => {
    const params = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    // ⭐ IMPORTANTE: Usar URL absoluta con import.meta.env.VITE_API_URL
    // En desarrollo: http://localhost:3000
    // En producción: https://api.example.com
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${baseUrl}/api/files/${encodeURIComponent(fileName)}/stream${params}`;
  },
};
