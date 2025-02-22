import { Meme, TagSuggestion } from '../types/meme';
import { TagService } from './tagService';

interface TagTask {
  meme: Meme;
  retries: number;
}

type TagsUpdateListener = () => void;

export class TagQueueService {
  private static instance: TagQueueService;
  private queue: TagTask[] = [];
  private isProcessing: boolean = false;
  private maxRetries: number = 3;
  private tagService: TagService;
  private onTagsGenerated?: (memeId: string, tags: string[]) => Promise<void>;
  private listeners: Set<TagsUpdateListener> = new Set();

  private constructor() {
    this.tagService = TagService.getInstance();
  }

  static getInstance(): TagQueueService {
    if (!TagQueueService.instance) {
      TagQueueService.instance = new TagQueueService();
    }
    return TagQueueService.instance;
  }

  setOnTagsGenerated(callback: (memeId: string, tags: string[]) => Promise<void>) {
    this.onTagsGenerated = callback;
  }

  addTagsUpdateListener(listener: TagsUpdateListener) {
    this.listeners.add(listener);
  }

  removeTagsUpdateListener(listener: TagsUpdateListener) {
    this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  addToQueue(meme: Meme) {
    this.queue.push({ meme, retries: 0 });
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !this.onTagsGenerated) {
      return;
    }

    this.isProcessing = true;

    try {
      const task = this.queue[0];
      const suggestions = await this.tagService.generateTags(task.meme.uri);
      
      if (suggestions.length > 0) {
        const tags = suggestions.map(s => s.tag);
        await this.onTagsGenerated(task.meme.id, tags);
        this.queue.shift(); // 移除已完成的任务
        this.notifyListeners(); // 通知监听器标签已更新
      } else if (task.retries < this.maxRetries) {
        // 如果生成失败但未超过重试次数，将任务移到队列末尾
        task.retries++;
        this.queue.push(this.queue.shift()!);
      } else {
        // 超过重试次数，放弃该任务
        console.warn('标签生成失败，超过最大重试次数:', task.meme.id);
        this.queue.shift();
      }
    } catch (error) {
      console.error('处理标签队列出错:', error);
      // 出错时将当前任务移到队列末尾
      const task = this.queue[0];
      if (task.retries < this.maxRetries) {
        task.retries++;
        this.queue.push(this.queue.shift()!);
      } else {
        this.queue.shift();
      }
    }

    this.isProcessing = false;

    // 添加延迟以避免API限制
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 2000);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
} 