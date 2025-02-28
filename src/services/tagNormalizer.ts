import { StorageService } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TagMapping {
  standard: string;
  aliases: string[];
  category?: string;
  frequency?: number;
}

// 初始标签映射表
const INITIAL_TAG_MAPPINGS: TagMapping[] = [
  {
    standard: "幽默",
    aliases: ["幽默场景", "搞笑", "有趣", "逗比", "幽默风格", "搞笑场景", "逗乐", "滑稽"],
    category: "情绪"
  },
  {
    standard: "生气",
    aliases: ["愤怒", "暴怒", "发火", "气愤", "恼火", "发怒", "愤慨"],
    category: "情绪"
  },
  {
    standard: "无语",
    aliases: ["无话可说", "speechless", "无言以对", "呆滞", "目瞪口呆"],
    category: "情绪"
  },
  {
    standard: "熊猫头",
    aliases: ["熊猫人", "胖达", "功夫熊猫", "熊猫表情", "熊猫脸"],
    category: "角色"
  },
  {
    standard: "狗头",
    aliases: ["黄狗", "狗子", "柴犬", "狗狗", "小狗", "汪星人"],
    category: "角色"
  },
  {
    standard: "猫咪",
    aliases: ["猫头", "喵星人", "小猫", "猫猫", "猫脸"],
    category: "角色"
  },
  {
    standard: "吐槽",
    aliases: ["吐槽场景", "调侃", "讽刺", "嘲讽", "挖苦"],
    category: "场景"
  },
  {
    standard: "日常",
    aliases: ["生活", "日常生活", "平常", "日常场景"],
    category: "场景"
  },
  {
    standard: "抽烟",
    aliases: ["吸烟", "抽菸", "吸菸", "抽雪茄", "吸雪茄"],
    category: "动作"
  },
  {
    standard: "喝酒",
    aliases: ["饮酒", "干杯", "碰杯", "喝啤酒", "饮酒场景"],
    category: "动作"
  },
  {
    standard: "思考",
    aliases: ["沉思", "冥想", "深思", "思索", "想事情"],
    category: "动作"
  }
];

export class TagNormalizer {
  private static instance: TagNormalizer;
  private tagMappings: TagMapping[] = INITIAL_TAG_MAPPINGS;
  private readonly MAPPINGS_STORAGE_KEY = '@meme_vault_tag_mappings';

  private constructor() {
    this.loadMappings();
  }

  static getInstance(): TagNormalizer {
    if (!TagNormalizer.instance) {
      TagNormalizer.instance = new TagNormalizer();
    }
    return TagNormalizer.instance;
  }

  private async loadMappings() {
    try {
      const savedMappingsJson = await AsyncStorage.getItem(this.MAPPINGS_STORAGE_KEY);
      if (savedMappingsJson) {
        this.tagMappings = JSON.parse(savedMappingsJson);
      }
    } catch (error) {
      console.error('加载标签映射失败:', error);
    }
  }

  private async saveMappings() {
    try {
      await AsyncStorage.setItem(
        this.MAPPINGS_STORAGE_KEY,
        JSON.stringify(this.tagMappings)
      );
    } catch (error) {
      console.error('保存标签映射失败:', error);
    }
  }

  // 计算两个字符串的相似度 (0-1)
  private calculateSimilarity(str1: string, str2: string): number {
    // 完全相等检查
    if (str1 === str2) {
      return 1;
    }

    // 同义词检查
    const synonymPairs = [
      ["抽", "吸"],
      ["烟", "菸"],
      ["想", "思"],
      ["笑", "乐"],
      ["哭", "泣"],
      ["说", "讲"],
      ["看", "瞧"],
      ["吃", "食"],
      ["喝", "饮"]
    ];

    let normalizedStr1 = str1;
    let normalizedStr2 = str2;

    // 应用同义词替换
    for (const [word1, word2] of synonymPairs) {
      if (str1.includes(word1) && str2.includes(word2) || 
          str1.includes(word2) && str2.includes(word1)) {
        return 0.9;
      }
    }

    // 完全包含关系检查
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.9;
    }

    // 去除常见后缀再比较
    const commonSuffixes = ["场景", "风格", "表情", "头", "脸", "人", "星人", "动作"];
    
    for (const suffix of commonSuffixes) {
      normalizedStr1 = normalizedStr1.replace(suffix, "");
      normalizedStr2 = normalizedStr2.replace(suffix, "");
    }

    if (normalizedStr1 === normalizedStr2) {
      return 0.95;
    }

    // 编辑距离计算
    const len1 = normalizedStr1.length;
    const len2 = normalizedStr2.length;
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = normalizedStr1[i - 1] === normalizedStr2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }

  // 标准化单个标签
  public normalizeTag(tag: string): string {
    // 完全匹配检查
    for (const mapping of this.tagMappings) {
      if (mapping.standard === tag) return tag;
      if (mapping.aliases.includes(tag)) {
        this.updateTagFrequency(mapping.standard);
        return mapping.standard;
      }
    }

    // 相似度检查
    const SIMILARITY_THRESHOLD = 0.75; // 降低阈值以捕获更多相似标签
    let bestMatch: { tag: string; similarity: number } | null = null;

    for (const mapping of this.tagMappings) {
      // 检查标准标签
      const standardSimilarity = this.calculateSimilarity(tag, mapping.standard);
      if (standardSimilarity > SIMILARITY_THRESHOLD) {
        if (!bestMatch || standardSimilarity > bestMatch.similarity) {
          bestMatch = { tag: mapping.standard, similarity: standardSimilarity };
        }
      }

      // 检查别名
      for (const alias of mapping.aliases) {
        const aliasSimilarity = this.calculateSimilarity(tag, alias);
        if (aliasSimilarity > SIMILARITY_THRESHOLD) {
          if (!bestMatch || aliasSimilarity > bestMatch.similarity) {
            bestMatch = { tag: mapping.standard, similarity: aliasSimilarity };
          }
        }
      }
    }

    if (bestMatch) {
      // 如果找到高相似度的匹配，自动添加为别名
      if (bestMatch.similarity > 0.85) {
        const mapping = this.tagMappings.find(m => m.standard === bestMatch!.tag);
        if (mapping && !mapping.aliases.includes(tag)) {
          mapping.aliases.push(tag);
          this.saveMappings();
        }
      }
      this.updateTagFrequency(bestMatch.tag);
      return bestMatch.tag;
    }

    return tag;
  }

  // 标准化多个标签
  public normalizeTags(tags: string[]): string[] {
    const normalizedTags = new Set<string>();
    for (const tag of tags) {
      normalizedTags.add(this.normalizeTag(tag));
    }
    return Array.from(normalizedTags);
  }

  // 添加新的标签映射
  public async addTagMapping(mapping: TagMapping) {
    // 检查是否已存在
    const existingIndex = this.tagMappings.findIndex(m => m.standard === mapping.standard);
    if (existingIndex >= 0) {
      // 合并别名
      const existing = this.tagMappings[existingIndex];
      const newAliases = new Set([...existing.aliases, ...mapping.aliases]);
      this.tagMappings[existingIndex] = {
        ...existing,
        aliases: Array.from(newAliases),
        category: mapping.category || existing.category
      };
    } else {
      this.tagMappings.push({ ...mapping, frequency: 0 });
    }
    await this.saveMappings();
  }

  // 获取所有标签映射
  public getTagMappings(): TagMapping[] {
    return [...this.tagMappings];
  }

  // 更新标签使用频率
  private async updateTagFrequency(tag: string) {
    const mapping = this.tagMappings.find(m => m.standard === tag);
    if (mapping) {
      mapping.frequency = (mapping.frequency || 0) + 1;
      await this.saveMappings();
    }
  }

  // 获取标签分类
  public getTagCategories(): string[] {
    const categories = new Set<string>();
    this.tagMappings.forEach(mapping => {
      if (mapping.category) {
        categories.add(mapping.category);
      }
    });
    return Array.from(categories);
  }

  // 根据分类获取标签
  public getTagsByCategory(category: string): string[] {
    return this.tagMappings
      .filter(mapping => mapping.category === category)
      .map(mapping => mapping.standard);
  }

  /**
   * 清除所有自定义标签映射，恢复到初始状态
   */
  public async clearAllMappings(): Promise<void> {
    try {
      // 重置为初始标签映射
      this.tagMappings = [...INITIAL_TAG_MAPPINGS];
      // 保存到存储
      await this.saveMappings();
      console.log('所有自定义标签映射已清除');
    } catch (error) {
      console.error('清除标签映射时出错:', error);
      throw error;
    }
  }
} 