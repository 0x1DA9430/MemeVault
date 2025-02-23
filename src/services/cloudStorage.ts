import { Platform } from 'react-native';
import * as NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Meme, CloudStorageConfig, CloudStorageType, CloudMeme, CloudSyncStats } from '../types/meme';
import { StorageService } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const CLOUD_CONFIG_KEY = '@meme_vault_cloud_config';
const SYNC_QUEUE_KEY = '@meme_vault_sync_queue';
const CLOUD_SYNC_STATS_KEY = '@meme_vault_cloud_sync_stats';
const CLOUD_INDEX_KEY = '@meme_vault_cloud_index';

export class CloudStorageService {
  private static instance: CloudStorageService;
  private initPromise: Promise<void>;
  private config: CloudStorageConfig = {
    enabled: false,
    type: 'imgur',
    autoSync: false,
    syncInterval: 120,  // 默认120分钟
    syncOnWifi: true,
    maxStorageSize: 1024, // 默认1GB
    compressionQuality: 0.8,
    deduplication: true,
  };
  private syncQueue: string[] = [];
  private isSyncing: boolean = false;
  private cloudIndex: Map<string, CloudMeme> = new Map();
  private syncStats: CloudSyncStats = {
    totalSize: 0,
    syncedCount: 0,
    failedCount: 0,
  };

  private constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    try {
      await Promise.all([
        this.loadConfig(),
        this.loadSyncQueue(),
        this.loadCloudIndex(),
        this.loadSyncStats()
      ]);
    } catch (error) {
      console.error('初始化失败:', error);
      throw error;
    }
  }

  static async getInstance(): Promise<CloudStorageService> {
    if (!CloudStorageService.instance) {
      CloudStorageService.instance = new CloudStorageService();
      await CloudStorageService.instance.initPromise;
    }
    return CloudStorageService.instance;
  }

  private async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async loadConfig(): Promise<void> {
    try {
      const configJson = await AsyncStorage.getItem(CLOUD_CONFIG_KEY);
      if (configJson) {
        const savedConfig = JSON.parse(configJson);
        this.config = {
          ...this.config,
          ...savedConfig,
        };
      }
    } catch (error) {
      console.error('加载云存储配置失败:', error);
      throw error;
    }
  }

  private async saveConfig() {
    try {
      await AsyncStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('保存云存储配置失败:', error);
    }
  }

  private async loadSyncQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (queueJson) {
        this.syncQueue = JSON.parse(queueJson);
      }
    } catch (error) {
      console.error('加载同步队列失败:', error);
    }
  }

  private async saveSyncQueue() {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('保存同步队列失败:', error);
    }
  }

  private async loadCloudIndex() {
    try {
      const indexJson = await AsyncStorage.getItem(CLOUD_INDEX_KEY);
      if (indexJson) {
        const indexArray = JSON.parse(indexJson);
        this.cloudIndex = new Map(indexArray.map((item: CloudMeme) => [item.id, item]));
      }
    } catch (error) {
      console.error('加载云端索引失败:', error);
    }
  }

  private async saveCloudIndex() {
    try {
      const indexArray = Array.from(this.cloudIndex.values());
      await AsyncStorage.setItem(CLOUD_INDEX_KEY, JSON.stringify(indexArray));
    } catch (error) {
      console.error('保存云端索引失败:', error);
    }
  }

  private async loadSyncStats() {
    try {
      const statsJson = await AsyncStorage.getItem(CLOUD_SYNC_STATS_KEY);
      if (statsJson) {
        this.syncStats = JSON.parse(statsJson);
      }
    } catch (error) {
      console.error('加载同步统计失败:', error);
    }
  }

  private async saveSyncStats() {
    try {
      await AsyncStorage.setItem(CLOUD_SYNC_STATS_KEY, JSON.stringify(this.syncStats));
    } catch (error) {
      console.error('保存同步统计失败:', error);
    }
  }

  async getConfig(): Promise<CloudStorageConfig> {
    await this.waitForInit();
    return { ...this.config };
  }

  async updateConfig(newConfig: Partial<CloudStorageConfig>): Promise<void> {
    await this.waitForInit();
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
  }

  private async uploadToImgur(imageUri: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('未配置 Imgur API 密钥');
    }

    try {
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          'Authorization': `Client-ID ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          type: 'base64',
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.data.error);
      }

      return data.data.link;
    } catch (error) {
      console.error('上传到 Imgur 失败:', error);
      throw error;
    }
  }

  private async uploadToSmms(imageUri: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('未配置 SM.MS API 密钥');
    }

    try {
      const formData = new FormData();
      formData.append('smfile', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });

      const response = await fetch('https://sm.ms/api/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': this.config.apiKey,
        },
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }

      return data.data.url;
    } catch (error) {
      console.error('上传到 SM.MS 失败:', error);
      throw error;
    }
  }

  private async uploadToGithub(imageUri: string, memeId: string): Promise<string> {
    if (!this.config.githubToken || !this.config.githubRepo) {
      throw new Error('未配置 GitHub 信息');
    }

    try {
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const [owner, repo] = this.config.githubRepo.split('/');
      const filename = `images/${memeId}`;  // 使用 memeId 作为文件名

      // 1. 检查 images 目录是否存在
      const checkDirResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/images`,
        {
          headers: {
            'Authorization': `token ${this.config.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // 2. 如果目录不存在，创建它
      if (checkDirResponse.status === 404) {
        console.log('正在创建 images 目录...');
        const createDirResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/images/.gitkeep`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${this.config.githubToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
              message: 'Create images directory',
              content: '',  // 空文件
              branch: 'main'
            })
          }
        );

        if (!createDirResponse.ok) {
          const errorData = await createDirResponse.json();
          throw new Error(`创建目录失败: ${errorData.message || '未知错误'}`);
        }
      } else if (!checkDirResponse.ok) {
        const errorData = await checkDirResponse.json();
        throw new Error(`检查目录失败: ${errorData.message || '未知错误'}`);
      }

      // 3. 上传图片
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.config.githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: 'Upload image via MemeVault',
            content: base64Image,
            branch: 'main'
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API 错误: ${response.status} - ${errorData.message || '未知错误'}`);
      }

      const data = await response.json();
      
      if (!data || !data.content || !data.content.download_url) {
        console.error('GitHub响应数据:', data);
        throw new Error('GitHub返回的数据格式不正确');
      }

      return data.content.download_url;
    } catch (error) {
      console.error('上传到 GitHub 失败:', error);
      if (error instanceof Error) {
        throw new Error(`上传到 GitHub 失败: ${error.message}`);
      }
      throw new Error('上传到 GitHub 失败: 未知错误');
    }
  }

  private async uploadToCustom(imageUri: string): Promise<string> {
    if (!this.config.apiEndpoint) {
      throw new Error('未配置自定义图床地址');
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          ...(this.config.apiKey && { 'Authorization': this.config.apiKey }),
        },
        body: formData,
      });

      const data = await response.json();
      if (!data.url) {
        throw new Error('上传失败');
      }

      return data.url;
    } catch (error) {
      console.error('上传到自定义图床失败:', error);
      throw error;
    }
  }

  // 计算图片哈希值
  private async calculateImageHash(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        new Uint8Array(buffer).toString()
      );
      return hash;
    } catch (error) {
      console.error('计算图片哈希值失败:', error);
      throw error;
    }
  }

  // 压缩图片
  private async compressImage(uri: string): Promise<string> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        {
          compress: this.config.compressionQuality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return result.uri;
    } catch (error) {
      console.error('压缩图片失败:', error);
      throw error;
    }
  }

  // 检查重复图片
  private async checkDuplicate(uri: string): Promise<CloudMeme | null> {
    if (!this.config.deduplication) return null;

    const hash = await this.calculateImageHash(uri);
    for (const cloudMeme of this.cloudIndex.values()) {
      if (cloudMeme.hash === hash) {
        return cloudMeme;
      }
    }
    return null;
  }

  // 从云端恢复
  async restoreFromCloud(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('云存储未启用');
    }

    await this.waitForInit();

    try {
      // 清理本地缓存
      this.cloudIndex.clear();
      this.syncStats = {
        totalSize: 0,
        syncedCount: 0,
        failedCount: 0,
        lastSyncTime: Date.now()
      };
      await this.saveCloudIndex();
      await this.saveSyncStats();

      // 从云端获取最新数据
      const storageService = StorageService.getInstance();
      let cloudMemes: CloudMeme[] = [];

      switch (this.config.type) {
        case 'github':
          if (this.config.githubToken && this.config.githubRepo) {
            const [owner, repo] = this.config.githubRepo.split('/');
            
            // 1. 获取图片文件列表
            const imagesResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/images`,
              {
                headers: {
                  'Authorization': `token ${this.config.githubToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                }
              }
            );

            if (!imagesResponse.ok) {
              if (imagesResponse.status === 404) {
                // 如果目录不存在，说明云端是空的
                return;
              }
              throw new Error(`获取云端文件列表失败: ${imagesResponse.statusText}`);
            }

            const files = await imagesResponse.json();
            if (!Array.isArray(files)) {
              throw new Error('无效的云端响应格式');
            }

            // 2. 获取 tags.json 文件
            const tagsResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/images/tags.json`,
              {
                headers: {
                  'Authorization': `token ${this.config.githubToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                }
              }
            );

            let memeTags: Record<string, string[]> = {};
            if (tagsResponse.ok) {
              const tagsFile = await tagsResponse.json();
              const tagsContent = await fetch(tagsFile.download_url).then(res => res.json());
              memeTags = tagsContent;
            }

            // 更新cloudIndex
            for (const file of files) {
              // 跳过 .gitkeep 文件和 tags.json
              if (file.type === 'file' && file.download_url && 
                  !file.name.endsWith('.gitkeep') && file.name !== 'tags.json') {
                // 从文件路径中提取文件名（不包含路径）
                const memeId = file.name;
                const cloudMeme: CloudMeme = {
                  id: memeId,
                  cloudUri: file.download_url,
                  hash: file.sha,
                  tags: memeTags[memeId] || [],  // 使用 memeId 匹配标签
                  createdAt: new Date().toISOString(),
                  modifiedAt: new Date().toISOString(),
                  size: file.size
                };
                this.cloudIndex.set(cloudMeme.id, cloudMeme);
                cloudMemes.push(cloudMeme);
              }
            }
          }
          break;
        // 其他图床的处理...
      }

      // 恢复过程...
      const localMemes = await storageService.getAllMemes();
      let restoredCount = 0;

      for (const cloudMeme of cloudMemes) {
        const localMeme = localMemes.find(m => m.id === cloudMeme.id);
        if (!localMeme) {
          try {
            // 使用 FileSystem 下载文件
            const localUri = `${FileSystem.documentDirectory}memes/${cloudMeme.id}`;
            await FileSystem.downloadAsync(cloudMeme.cloudUri, localUri);
            
            // 创建新的 Meme，包含标签信息
            const meme: Meme = {
              id: cloudMeme.id,
              uri: localUri,
              tags: cloudMeme.tags || [],  // 使用云端的标签
              createdAt: new Date(),
              modifiedAt: new Date(),
              size: cloudMeme.size,
              width: 0,
              height: 0,
              favorite: false,
              hash: cloudMeme.hash,
              cloudUri: cloudMeme.cloudUri,
              syncStatus: 'synced'
            };

            // 保存到本地
            const memes = await storageService.getAllMemes();
            memes.push(meme);
            await storageService.saveMemes(memes);
            restoredCount++;
          } catch (error) {
            console.error(`恢复文件失败: ${cloudMeme.id}`, error);
            this.syncStats.failedCount++;
          }
        }
      }

      // 更新同步状态
      this.syncStats.syncedCount = restoredCount;
      this.syncStats.lastSyncTime = Date.now();
      await this.saveSyncStats();
      await this.saveCloudIndex();

    } catch (error) {
      console.error('从云端恢复失败:', error);
      throw error;
    }
  }

  // 获取同步状态
  async getSyncStats(): Promise<CloudSyncStats> {
    return this.syncStats;
  }

  // 清理云端存储
  async cleanupCloudStorage(): Promise<void> {
    if (!this.config.enabled) return;

    const totalSize = Array.from(this.cloudIndex.values())
      .reduce((sum, meme) => sum + meme.size, 0);

    if (totalSize > this.config.maxStorageSize * 1024 * 1024) {
      // 按修改时间排序，删除最旧的文件
      const sortedMemes = Array.from(this.cloudIndex.values())
        .sort((a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime());

      while (this.syncStats.totalSize > this.config.maxStorageSize * 1024 * 1024 && sortedMemes.length > 0) {
        const oldestMeme = sortedMemes.shift();
        if (oldestMeme) {
          await this.deleteFromCloud(oldestMeme.id);
        }
      }
    }
  }

  // 从云端删除
  private async deleteFromCloud(memeId: string): Promise<void> {
    const cloudMeme = this.cloudIndex.get(memeId);
    if (!cloudMeme) return;

    try {
      switch (this.config.type) {
        case 'github':
          // 从GitHub删除文件
          if (this.config.githubToken && this.config.githubRepo) {
            const [owner, repo] = this.config.githubRepo.split('/');
            const path = new URL(cloudMeme.cloudUri).pathname.split('/').pop();
            await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `token ${this.config.githubToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: 'Delete via MemeVault',
                  sha: cloudMeme.hash,
                }),
              }
            );
          }
          break;
        // 其他图床可能不支持删除操作
      }

      this.cloudIndex.delete(memeId);
      this.syncStats.totalSize -= cloudMeme.size;
      await this.saveCloudIndex();
      await this.saveSyncStats();
    } catch (error) {
      console.error('从云端删除失败:', error);
    }
  }

  // 修改上传图片方法
  async uploadImage(meme: Meme): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('云存储未启用');
    }

    try {
      // 检查重复
      const duplicate = await this.checkDuplicate(meme.uri);
      if (duplicate) {
        return duplicate.cloudUri;
      }

      // 压缩图片
      const compressedUri = await this.compressImage(meme.uri);
      
      // 计算哈希值
      const hash = await this.calculateImageHash(compressedUri);

      let cloudUri: string;
      switch (this.config.type) {
        case 'github':
          cloudUri = await this.uploadToGithub(compressedUri, meme.id);
          
          // 更新 tags.json
          if (this.config.githubToken && this.config.githubRepo) {
            const [owner, repo] = this.config.githubRepo.split('/');
            
            // 获取现有的 tags.json
            let memeTags: Record<string, string[]> = {};
            let existingSha: string | undefined;
            
            try {
              const tagsResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/images/tags.json`,
                {
                  headers: {
                    'Authorization': `token ${this.config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                  }
                }
              );
              
              if (tagsResponse.ok) {
                const tagsFile = await tagsResponse.json();
                existingSha = tagsFile.sha;
                const tagsContent = await fetch(tagsFile.download_url).then(res => res.json());
                memeTags = tagsContent;
              }
            } catch (error) {
              console.log('tags.json 不存在，将创建新文件');
            }

            // 更新标签信息
            memeTags[meme.id] = meme.tags || [];

            // 将对象转换为 JSON 字符串，然后转换为 base64
            const jsonStr = JSON.stringify(memeTags, null, 2);
            const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

            // 上传更新后的 tags.json
            const tagsUpdateResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/images/tags.json`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `token ${this.config.githubToken}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                  message: 'Update tags',
                  content: base64Content,
                  ...(existingSha ? { sha: existingSha } : {})
                })
              }
            );

            if (!tagsUpdateResponse.ok) {
              console.error('更新 tags.json 失败');
            }
          }
          break;
        case 'imgur':
          cloudUri = await this.uploadToImgur(compressedUri);
          break;
        case 'sm.ms':
          cloudUri = await this.uploadToSmms(compressedUri);
          break;
        case 'custom':
          cloudUri = await this.uploadToCustom(compressedUri);
          break;
        default:
          throw new Error('不支持的图床类型');
      }

      // 更新云端索引
      const fileInfo = await FileSystem.getInfoAsync(compressedUri);
      const cloudMeme: CloudMeme = {
        id: meme.id,
        cloudUri,
        hash,
        tags: meme.tags || [],
        createdAt: (meme.createdAt instanceof Date) ? meme.createdAt.toISOString() : new Date().toISOString(),
        modifiedAt: (meme.modifiedAt instanceof Date) ? meme.modifiedAt.toISOString() : new Date().toISOString(),
        size: (fileInfo as any).size || 0,
      };

      this.cloudIndex.set(meme.id, cloudMeme);
      this.syncStats.totalSize += cloudMeme.size;
      this.syncStats.syncedCount++;
      this.syncStats.lastSyncTime = Date.now();

      await this.saveCloudIndex();
      await this.saveSyncStats();
      await this.cleanupCloudStorage();

      return cloudUri;
    } catch (error) {
      console.error('上传图片失败:', error);
      this.syncStats.failedCount++;
      await this.saveSyncStats();
      throw error;
    }
  }

  async addToSyncQueue(memeId: string) {
    if (!this.syncQueue.includes(memeId)) {
      this.syncQueue.push(memeId);
      await this.saveSyncQueue();
      this.processSyncQueue();
    }
  }

  private async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.length === 0 || !this.config.enabled) {
      return;
    }

    // 检查是否符合同步条件
    if (this.config.syncOnWifi) {
      const netInfo = await NetInfo.fetch();
      if (netInfo.type !== 'wifi') {
        return;
      }
    }

    this.isSyncing = true;
    const storageService = StorageService.getInstance();

    try {
      while (this.syncQueue.length > 0) {
        const memeId = this.syncQueue[0];
        const allMemes = await storageService.getAllMemes();
        const meme = allMemes.find(m => m.id === memeId);

        if (meme && !meme.cloudUri) {
          try {
            const cloudUri = await this.uploadImage(meme);
            meme.cloudUri = cloudUri;
            meme.syncStatus = 'synced';
            await storageService.saveMemes(allMemes);
            this.syncQueue.shift();
            await this.saveSyncQueue();
          } catch (error) {
            console.error('同步失败:', error);
            meme.syncStatus = 'failed';
            await storageService.saveMemes(allMemes);
            this.syncQueue.shift();
            await this.saveSyncQueue();
          }
        } else {
          this.syncQueue.shift();
          await this.saveSyncQueue();
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async syncAll() {
    const storageService = StorageService.getInstance();
    const allMemes = await storageService.getAllMemes();
    
    const unsyncedMemes = allMemes.filter(meme => !meme.cloudUri);
    for (const meme of unsyncedMemes) {
      await this.addToSyncQueue(meme.id);
    }
  }
} 