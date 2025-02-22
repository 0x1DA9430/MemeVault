import { Meme, TagSuggestion } from '../types/meme';
import { SettingsService } from './settings';

export class TagService {
  private static instance: TagService;
  private settingsService: SettingsService;
  private readonly MAX_TAG_LENGTH = 5;
  private readonly TIMEOUT = 60000; // 增加到60秒
  private readonly MAX_RETRIES = 2; // 单次请求的最大重试次数

  private constructor() {
    this.settingsService = SettingsService.getInstance();
  }

  static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  private validateTagLength(tag: string): boolean {
    // 计算字符串的实际字符数（考虑中文字符）
    return Array.from(tag).length <= this.MAX_TAG_LENGTH;
  }

  private async retryWithTimeout<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
        
        try {
          const result = await operation();
          clearTimeout(timeoutId);
          return result;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('未知错误');
        if (i === retries) {
          throw lastError;
        }
        // 指数退避重试
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('重试失败');
  }

  async generateTags(imageUri: string): Promise<TagSuggestion[]> {
    const settings = await this.settingsService.getSettings();
    if (!settings.enabled || !settings.apiKey) {
      return [];
    }

    try {
      const base64Image = await this.imageToBase64(imageUri);
      
      const makeRequest = async () => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "请分析这张图片并生成最多6个标签。要求：\n1. 每个标签最多5个字\n2. 如果图片包含文字，提取关键词作为标签\n3. 分析图片的情绪（如：搞笑、悲伤等）\n4. 识别主要主体（如：人物、动物等）\n5. 理解图片的寓意或场景\n\n请用JSON数组格式返回，每个标签包含以下字段：\n- tag: 标签文本（中文，限5字以内）\n- confidence: 置信度（0-1）\n- type: 类型（text/emotion/subject/meaning）"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API错误响应:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(
            errorData.error?.message || 
            `API请求失败: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('无法解析API响应');
        }

        // 尝试提取JSON部分
        const jsonMatch = content.match(/\[.*\]/s);
        if (!jsonMatch) {
          console.error('无法找到JSON内容:', content);
          throw new Error('返回格式错误');
        }
        
        const suggestions = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(suggestions)) {
          throw new Error('API返回格式错误');
        }

        // 验证每个标签的格式和长度
        const validSuggestions = suggestions.filter(s => 
          s && typeof s === 'object' && 
          typeof s.tag === 'string' && 
          this.validateTagLength(s.tag) &&
          typeof s.confidence === 'number' && 
          ['text', 'emotion', 'subject', 'meaning'].includes(s.type)
        );

        if (validSuggestions.length === 0) {
          throw new Error('没有有效的标签');
        }

        return validSuggestions.slice(0, settings.maxTags);
      };

      return await this.retryWithTimeout(makeRequest);
    } catch (error) {
      // 记录详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('生成标签失败:', {
        error: errorMessage,
        stack: errorStack,
        uri: imageUri.substring(0, 100) + '...' // 只记录URI的开头部分
      });
      throw new Error(errorMessage);
    }
  }

  private async imageToBase64(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('转换图片失败:', error);
      throw error;
    }
  }

  async validateTags(tags: string[]): Promise<string[]> {
    const settings = await this.settingsService.getSettings();
    return tags
      .filter(tag => this.validateTagLength(tag))
      .slice(0, settings.maxTags);
  }
} 