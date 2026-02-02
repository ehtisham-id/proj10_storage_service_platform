export interface User {
  id: string;
  email: string;
  name: string;
}

export interface FileVersion {
  id: string;
  versionNumber: number;
  filePath: string;
  size?: number;
  mimeType?: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  user: User;
  role: 'owner' | 'editor' | 'viewer';
}

export interface File {
  id: string;
  name: string;
  owner: User;
  versions: FileVersion[];
  permissions: Permission[];
  createdAt: string;
  latestDownloadUrl: string;
}
