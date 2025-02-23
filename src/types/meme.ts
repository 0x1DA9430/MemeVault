export interface Meme {
  id: string;
  uri: string;
  title?: string;
  tags: string[];
  createdAt: Date;
  modifiedAt: Date;
  size: number;
  width: number;
  height: number;
  favorite: boolean;
  hash?: string;
  cloudUri?: string;  // 云端图片地址
  syncStatus?: 'synced' | 'pending' | 'failed';  // 同步状态
}

export type MemeCollection = {
  id: string;
  name: string;
  memes: Meme[];
  createdAt: Date;
  modifiedAt: Date;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  type: 'text' | 'emotion' | 'subject' | 'meaning';
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface AutoTagSettings {
  enabled: boolean;
  apiKey: string;
  maxTags: number;
  themeMode: ThemeMode;
}

export type CloudStorageType = 'imgur' | 'sm.ms' | 'github' | 'custom';

export interface CloudMeme {
  id: string;
  cloudUri: string;
  hash: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  size: number;
}

export interface CloudSyncStats {
  totalSize: number;
  syncedCount: number;
  failedCount: number;
  lastSyncTime?: number;
}

export interface CloudStorageConfig {
  enabled: boolean;
  type: CloudStorageType;
  apiKey?: string;
  apiEndpoint?: string;
  githubRepo?: string;
  githubToken?: string;
  autoSync: boolean;
  syncOnWifi: boolean;
  maxStorageSize: number;  // 最大存储空间（MB）
  compressionQuality: number;  // 图片压缩质量 (0-1)
  deduplication: boolean;  // 是否启用重复检测
} 