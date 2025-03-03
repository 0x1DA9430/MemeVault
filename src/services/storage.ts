import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { Meme, MemeCollection } from '../types/meme';
import { TagService } from './tagService';
import { SettingsService } from './settings';
import { TagQueueService } from './tagQueue';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';

const MEMES_STORAGE_KEY = '@meme_vault_memes';
const COLLECTIONS_STORAGE_KEY = '@meme_vault_collections';
const SHARE_COUNTS_KEY = '@meme_vault_share_counts';
const USAGE_RECORDS_KEY = '@meme_vault_usage_records';

interface UsageRecord {
  memeId: string;
  timestamp: number;
  type: 'share' | 'view' | 'favorite';
}

export class StorageService {
  private static instance: StorageService;
  private memeDirectory: string;
  private tagService: TagService;
  private settingsService: SettingsService;
  private tagQueueService: TagQueueService;

  private constructor() {
    this.memeDirectory = `${FileSystem.documentDirectory}memes/`;
    this.tagService = TagService.getInstance();
    this.settingsService = SettingsService.getInstance();
    this.tagQueueService = TagQueueService.getInstance();
    this.ensureMemeDirectory();
    
    // 设置标签生成回调
    this.tagQueueService.setOnTagsGenerated(async (memeId: string, tags: string[]) => {
      await this.updateMemeTags(memeId, tags);
    });
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private async ensureMemeDirectory() {
    const dirInfo = await FileSystem.getInfoAsync(this.memeDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.memeDirectory, { intermediates: true });
    }
  }

  async saveMeme(uri: string, title?: string): Promise<Meme> {
    const fileName = `${Date.now()}.jpg`;
    const newUri = `${this.memeDirectory}${fileName}`;
    
    await FileSystem.copyAsync({
      from: uri,
      to: newUri
    });

    const fileInfo = await FileSystem.getInfoAsync(newUri);
    
    const meme: Meme = {
      id: fileName,
      uri: newUri,
      title,
      tags: [],
      createdAt: new Date(),
      modifiedAt: new Date(),
      size: (fileInfo as any).size || 0,
      width: 0,
      height: 0,
      favorite: false
    };

    const settings = await this.settingsService.getSettings();
    if (settings.enabled) {
      this.tagQueueService.addToQueue(meme);
    }

    const memes = await this.getMemes();
    memes.push(meme);
    await this.saveMemes(memes);

    return meme;
  }

  async updateMemeTags(memeId: string, tags: string[]): Promise<void> {
    const memes = await this.getMemes();
    const index = memes.findIndex(m => m.id === memeId);
    
    if (index >= 0) {
      memes[index].tags = await this.tagService.validateTags(tags);
      memes[index].modifiedAt = new Date();
      await this.saveMemes(memes);
    }
  }

  async searchMemesByTags(tags: string[]): Promise<Meme[]> {
    if (!tags.length) return this.getMemes();
    
    const memes = await this.getMemes();
    return memes.filter(meme => 
      tags.every(tag => meme.tags.includes(tag))
    );
  }

  async getAllTags(): Promise<string[]> {
    const memes = await this.getMemes();
    const tagSet = new Set<string>();
    
    memes.forEach(meme => {
      meme.tags.forEach(tag => tagSet.add(tag));
    });
    
    return Array.from(tagSet).sort();
  }

  async saveToGallery(meme: Meme): Promise<void> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.createAssetAsync(meme.uri);
      }
    } catch (error) {
      console.error('保存到相册失败:', error);
      throw error;
    }
  }

  private async getMemes(): Promise<Meme[]> {
    try {
      const memesJson = await AsyncStorage.getItem(MEMES_STORAGE_KEY);
      return memesJson ? JSON.parse(memesJson) : [];
    } catch (error) {
      console.error('Error loading memes:', error);
      return [];
    }
  }

  async saveMemes(memes: Meme[]): Promise<void> {
    try {
      await AsyncStorage.setItem(MEMES_STORAGE_KEY, JSON.stringify(memes));
    } catch (error) {
      console.error('Error saving memes:', error);
    }
  }

  async deleteMeme(memeId: string): Promise<void> {
    const memes = await this.getMemes();
    const meme = memes.find(m => m.id === memeId);
    
    if (meme) {
      // 删除图片文件
      await FileSystem.deleteAsync(meme.uri);
      
      // 清理标签
      await this.tagService.removeTagsFromMeme(memeId);
      
      // 从memes列表中移除
      const updatedMemes = memes.filter(m => m.id !== memeId);
      await this.saveMemes(updatedMemes);
    }
  }

  async getAllMemes(): Promise<Meme[]> {
    return this.getMemes();
  }

  async getCollections(): Promise<MemeCollection[]> {
    try {
      const collectionsJson = await AsyncStorage.getItem(COLLECTIONS_STORAGE_KEY);
      return collectionsJson ? JSON.parse(collectionsJson) : [];
    } catch (error) {
      console.error('Error loading collections:', error);
      return [];
    }
  }

  async saveCollection(collection: MemeCollection): Promise<void> {
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === collection.id);
    
    if (index >= 0) {
      collections[index] = collection;
    } else {
      collections.push(collection);
    }

    try {
      await AsyncStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
    } catch (error) {
      console.error('Error saving collection:', error);
    }
  }

  // 新增：通用存储项目获取方法
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('获取存储项目失败:', error);
      return null;
    }
  }

  // 新增：通用存储项目设置方法
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('保存存储项目失败:', error);
      throw error;
    }
  }

  // 切换收藏状态
  async toggleFavorite(memeId: string): Promise<void> {
    const memes = await this.getMemes();
    const index = memes.findIndex(m => m.id === memeId);
    
    if (index >= 0) {
      memes[index].favorite = !memes[index].favorite;
      memes[index].modifiedAt = new Date();
      await this.saveMemes(memes);
      await this.recordUsage(memeId, 'favorite');
    }
  }

  // 获取收藏的表情包
  async getFavoriteMemes(): Promise<Meme[]> {
    const memes = await this.getMemes();
    return memes.filter(meme => meme.favorite);
  }

  // 批量导出表情包
  async exportMemes(memeIds: string[]): Promise<string> {
    try {
      // 创建临时导出目录
      const exportDir = `${FileSystem.cacheDirectory}export_${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

      // 复制选中的表情包到导出目录
      const memes = await this.getMemes();
      const selectedMemes = memes.filter(meme => memeIds.includes(meme.id));
      
      for (const meme of selectedMemes) {
        const fileName = meme.id;
        await FileSystem.copyAsync({
          from: meme.uri,
          to: `${exportDir}${fileName}`
        });
      }

      // 使用expo-file-system创建压缩文件
      const zipFileName = `${FileSystem.cacheDirectory}memes_${Date.now()}.zip`;
      await FileSystem.downloadAsync(
        `file://${exportDir}`,
        zipFileName,
        {
          headers: {
            "Content-Type": "application/zip"
          }
        }
      );

      // 清理临时导出目录
      await FileSystem.deleteAsync(exportDir, { idempotent: true });
      
      return zipFileName;
    } catch (error) {
      console.error('导出失败:', error);
      throw error;
    }
  }

  // 计算图片哈希值
  private async calculateImageHash(uri: string): Promise<string> {
    try {
      // 1. 将图片调整为统一大小
      const resizedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 32, height: 32 } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // 2. 计算图片数据的哈希值
      if (resizedImage.base64) {
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          resizedImage.base64
        );
        return hash;
      }
      throw new Error('无法生成图片base64数据');
    } catch (error) {
      console.error('计算图片哈希值失败:', error);
      throw error;
    }
  }

  // 检测重复表情包
  async findDuplicateMemes(): Promise<{ original: Meme, duplicates: Meme[] }[]> {
    try {
      const memes = await this.getMemes();
      const duplicateGroups: { [hash: string]: Meme[] } = {};

      // 1. 确保所有表情包都有哈希值
      for (const meme of memes) {
        if (!meme.hash) {
          meme.hash = await this.calculateImageHash(meme.uri);
        }
      }

      // 2. 按哈希值分组
      memes.forEach(meme => {
        if (meme.hash) {
          if (!duplicateGroups[meme.hash]) {
            duplicateGroups[meme.hash] = [];
          }
          duplicateGroups[meme.hash].push(meme);
        }
      });

      // 3. 找出重复组
      return Object.values(duplicateGroups)
        .filter(group => group.length > 1)
        .map(group => ({
          original: group[0],
          duplicates: group.slice(1)
        }));
    } catch (error) {
      console.error('检测重复表情包失败:', error);
      throw error;
    }
  }

  // 批量删除表情包
  async deleteMemes(memeIds: string[]): Promise<void> {
    const memes = await this.getMemes();
    
    for (const memeId of memeIds) {
      const meme = memes.find(m => m.id === memeId);
      if (meme) {
        // 删除图片文件
        await FileSystem.deleteAsync(meme.uri).catch(console.error);
        // 清理标签
        await this.tagService.removeTagsFromMeme(memeId);
      }
    }

    const updatedMemes = memes.filter(m => !memeIds.includes(m.id));
    await this.saveMemes(updatedMemes);
  }

  /**
   * 删除所有数据，包括所有表情包、收藏夹和使用记录
   * @param onComplete 删除完成后的回调函数，用于通知UI刷新
   */
  async deleteAllData(onComplete?: () => void): Promise<void> {
    try {
      // 获取所有表情包
      const memes = await this.getMemes();
      
      // 删除所有表情包文件
      for (const meme of memes) {
        await FileSystem.deleteAsync(meme.uri).catch(console.error);
      }
      
      // 清空表情包存储
      await AsyncStorage.setItem(MEMES_STORAGE_KEY, JSON.stringify([]));
      
      // 清空收藏夹
      await AsyncStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify([]));
      
      // 清空使用记录
      await AsyncStorage.setItem(USAGE_RECORDS_KEY, JSON.stringify([]));
      
      // 清空分享计数
      await AsyncStorage.setItem(SHARE_COUNTS_KEY, JSON.stringify({}));
      
      // 清空标签数据
      await this.tagService.clearAllTags();
      
      // 重置设置为默认值
      await this.settingsService.resetSettings();
      
      // 确保表情包目录存在但为空
      await this.ensureMemeDirectory();
      
      console.log('所有数据已删除');
      
      // 调用回调函数通知UI刷新
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('删除所有数据时出错:', error);
      throw error;
    }
  }

  // 记录使用记录
  async recordUsage(memeId: string, type: 'share' | 'view' | 'favorite'): Promise<void> {
    try {
      const records = await this.getUsageRecords();
      records.push({
        memeId,
        timestamp: Date.now(),
        type
      });
      await AsyncStorage.setItem(USAGE_RECORDS_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('记录使用记录失败:', error);
    }
  }

  // 获取所有使用记录
  private async getUsageRecords(): Promise<UsageRecord[]> {
    try {
      const recordsJson = await AsyncStorage.getItem(USAGE_RECORDS_KEY);
      return recordsJson ? JSON.parse(recordsJson) : [];
    } catch (error) {
      console.error('获取使用记录失败:', error);
      return [];
    }
  }

  // 获取每周使用统计
  async getWeeklyStats(): Promise<{ date: string; count: number }[]> {
    try {
      const records = await this.getUsageRecords();
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); // 获取7天前的日期
      weekStart.setHours(0, 0, 0, 0); // 设置为当天开始时间
      
      // 创建过去7天的统计数据
      const stats = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        return {
          date: '周' + '日一二三四五六'[date.getDay()],
          timestamp: date.getTime(),
          count: 0
        };
      });

      // 统计每天的使用次数
      records.forEach(record => {
        const recordDate = new Date(record.timestamp);
        // 只统计最近7天的记录
        if (recordDate >= weekStart && recordDate <= now) {
          // 计算记录日期与起始日期的天数差
          const dayDiff = Math.floor((recordDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
          if (dayDiff >= 0 && dayDiff < 7) {
            stats[dayDiff].count++;
          }
        }
      });

      // 返回按日期排序的统计数据
      return stats;
    } catch (error) {
      console.error('获取每周统计失败:', error);
      return [];
    }
  }

  // 记录分享次数
  async recordShare(memeId: string): Promise<void> {
    try {
      const shareCounts = await this.getShareCounts();
      shareCounts[memeId] = (shareCounts[memeId] || 0) + 1;
      await AsyncStorage.setItem(SHARE_COUNTS_KEY, JSON.stringify(shareCounts));
      await this.recordUsage(memeId, 'share');
    } catch (error) {
      console.error('记录分享次数失败:', error);
    }
  }

  // 获取所有分享次数
  private async getShareCounts(): Promise<Record<string, number>> {
    try {
      const countsJson = await AsyncStorage.getItem(SHARE_COUNTS_KEY);
      return countsJson ? JSON.parse(countsJson) : {};
    } catch (error) {
      console.error('获取分享次数失败:', error);
      return {};
    }
  }

  // 获取常用表情包
  async getPopularMemes(): Promise<{ id: string; uri: string; useCount: number }[]> {
    try {
      const memes = await this.getMemes();
      const shareCounts = await this.getShareCounts();

      return memes
        .map(meme => ({
          id: meme.id,
          uri: meme.uri,
          useCount: shareCounts[meme.id] || 0
        }))
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, 10);
    } catch (error) {
      console.error('获取常用表情包失败:', error);
      return [];
    }
  }

  // 获取表情包详细使用统计
  async getMemeUsageStats(memeId: string): Promise<{
    shareCount: number;
    viewCount: number;
    favoriteCount: number;
  }> {
    try {
      const records = await this.getUsageRecords();
      const memeRecords = records.filter(r => r.memeId === memeId);
      
      return {
        shareCount: memeRecords.filter(r => r.type === 'share').length,
        viewCount: memeRecords.filter(r => r.type === 'view').length,
        favoriteCount: memeRecords.filter(r => r.type === 'favorite').length,
      };
    } catch (error) {
      console.error('获取表情包使用统计失败:', error);
      return { shareCount: 0, viewCount: 0, favoriteCount: 0 };
    }
  }

  // 获取标签使用频率统计
  async getTagUsageStats(): Promise<{ tag: string; count: number }[]> {
    try {
      const memes = await this.getMemes();
      const records = await this.getUsageRecords();
      const tagUsage = new Map<string, number>();

      // 遍历所有使用记录
      for (const record of records) {
        const meme = memes.find(m => m.id === record.memeId);
        if (meme) {
          // 将该表情包的所有标签的使用次数都加1
          meme.tags.forEach(tag => {
            tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1);
          });
        }
      }

      // 转换为数组并排序
      return Array.from(tagUsage.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('获取标签使用统计失败:', error);
      return [];
    }
  }
}  