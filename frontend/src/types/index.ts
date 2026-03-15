export interface FileInfo {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  type?: 'file' | 'folder';
  path?: string;
}

export interface FolderInfo {
  type: 'folder';
  name: string;
  path: string;
}

export interface FileListResponse {
  files: FileInfo[];
  folders: FolderInfo[];
  currentPath: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentFile: FileInfo | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
