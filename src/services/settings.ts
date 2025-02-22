import AsyncStorage from '@react-native-async-storage/async-storage';
import { AutoTagSettings } from '../types/meme';

const SETTINGS_STORAGE_KEY = '@meme_vault_settings';

const DEFAULT_SETTINGS: AutoTagSettings = {
  enabled: false,
  apiKey: '',
  maxTags: 6,
};

export class SettingsService {
  private static instance: SettingsService;
  private settings: AutoTagSettings = DEFAULT_SETTINGS;
  private initialized: boolean = false;

  private constructor() {
    this.loadSettings().then(() => {
      this.initialized = true;
    });
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async loadSettings(): Promise<AutoTagSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
    return this.settings;
  }

  async saveSettings(settings: Partial<AutoTagSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  async getSettings(): Promise<AutoTagSettings> {
    if (!this.initialized) {
      await this.loadSettings();
      this.initialized = true;
    }
    return this.settings;
  }
} 