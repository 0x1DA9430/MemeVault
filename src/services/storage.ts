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

  private async saveMemes(memes: Meme[]): Promise<void> {
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
      await FileSystem.deleteAsync(meme.uri);
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

      // 创建压缩文件
      const zipFileName = `${FileSystem.cacheDirectory}memes_${Date.now()}.zip`;
      // 这里需要实现压缩功能，可以使用第三方库如 react-native-zip-archive
      // 为简化示例，这里直接返回导出目录
      
      return exportDir;
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
        await FileSystem.deleteAsync(meme.uri).catch(console.error);
      }
    }

    const updatedMemes = memes.filter(m => !memeIds.includes(m.id));
    await this.saveMemes(updatedMemes);
  }
}  