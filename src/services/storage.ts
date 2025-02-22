import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Meme, MemeCollection } from '../types/meme';

const MEMES_STORAGE_KEY = '@meme_vault_memes';
const COLLECTIONS_STORAGE_KEY = '@meme_vault_collections';

export class StorageService {
  private static instance: StorageService;
  private memeDirectory: string;

  private constructor() {
    this.memeDirectory = `${FileSystem.documentDirectory}memes/`;
    this.ensureMemeDirectory();
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
      size: (fileInfo as any).size || 0, // Type assertion for backward compatibility
      width: 0, // 需要获取实际尺寸
      height: 0,
      favorite: false
    };

    const memes = await this.getMemes();
    memes.push(meme);
    await this.saveMemes(memes);

    return meme;
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
}  