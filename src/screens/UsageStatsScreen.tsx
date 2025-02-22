import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { StorageService } from '../services/storage';
import { TagService } from '../services/tagService';
import { useTheme } from '../contexts/ThemeContext';
import { Meme } from '../types/meme';

type RootStackParamList = {
  UsageStats: {
    type: 'memes' | 'tags' | 'overview';
  };
};

type UsageStatsScreenProps = {
  route: RouteProp<RootStackParamList, 'UsageStats'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'UsageStats'>;
};

interface StatsData {
  memeCount: number;
  tagCount: number;
  favoriteCount: number;
  topMemes: { id: string; uri: string; useCount: number }[];
  topTags: { tag: string; count: number }[];
  tagCategories: { category: string; count: number }[];
  weeklyStats: { date: string; count: number }[];
}

export const UsageStatsScreen: React.FC<UsageStatsScreenProps> = ({ route, navigation }) => {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    memeCount: 0,
    tagCount: 0,
    favoriteCount: 0,
    topMemes: [],
    topTags: [],
    tagCategories: [],
    weeklyStats: [],
  });

  const screenWidth = Dimensions.get('window').width;
  const chartConfig = {
    backgroundColor: isDarkMode ? 'transparent' : '#fff',
    backgroundGradientFrom: isDarkMode ? 'transparent' : '#fff',
    backgroundGradientTo: isDarkMode ? 'transparent' : '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => isDarkMode ? 
      `rgba(96, 165, 250, ${opacity})` :  // 科技感浅蓝色
      `rgba(59, 130, 246, ${opacity})`,  // 更深的蓝色
    labelColor: (opacity = 1) => isDarkMode ? 
      `rgba(255, 255, 255, ${opacity})` :  // 深色模式文字颜色
      `rgba(0, 0, 0, ${opacity})`,  // 亮色模式文字颜色
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: isDarkMode ? '#60A5FA' : '#3B82F6',
    },
  };

  useEffect(() => {
    loadStats();
  }, [route.params.type]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const storageService = StorageService.getInstance();
      const tagService = TagService.getInstance();
      
      const memes = await storageService.getAllMemes();
      const tags = await storageService.getAllTags();
      const favorites = memes.filter(meme => meme.favorite);
      
      // 获取标签分类统计
      const categories = tagService.getTagCategories();
      const allTags = await storageService.getAllTags();
      const tagCategories = categories.map(category => {
        const tagsInCategory = tagService.getTagsByCategory(category);
        const count = memes.reduce((acc, meme) => {
          return acc + meme.tags.filter(tag => tagsInCategory.includes(tag)).length;
        }, 0);
        return {
          category,
          count
        };
      });

      // 获取热门表情包数据
      const topMemes = await storageService.getPopularMemes();

      // 获取标签使用频率
      const topTags = (await storageService.getTagUsageStats()).slice(0, 10);

      // 获取每周使用统计
      const weeklyStats = await storageService.getWeeklyStats();

      setStats({
        memeCount: memes.length,
        tagCount: tags.length,
        favoriteCount: favorites.length,
        topMemes,
        topTags,
        tagCategories,
        weeklyStats,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#007AFF'} />
      </View>
    );
  }

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>总览</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statsCard, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.statsNumber, { color: isDarkMode ? '#fff' : '#000' }]}>{stats.memeCount}</Text>
          <Text style={[styles.statsLabel, { color: isDarkMode ? '#fff' : '#666' }]}>表情包总数</Text>
        </View>
        <View style={[styles.statsCard, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.statsNumber, { color: isDarkMode ? '#fff' : '#000' }]}>{stats.tagCount}</Text>
          <Text style={[styles.statsLabel, { color: isDarkMode ? '#fff' : '#666' }]}>标签总数</Text>
        </View>
        <View style={[styles.statsCard, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.statsNumber, { color: isDarkMode ? '#fff' : '#000' }]}>{stats.favoriteCount}</Text>
          <Text style={[styles.statsLabel, { color: isDarkMode ? '#fff' : '#666' }]}>收藏数量</Text>
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={[styles.chartTitle, { color: isDarkMode ? '#fff' : '#000' }]}>每周使用趋势</Text>
        <LineChart
          data={{
            labels: stats.weeklyStats.map(stat => stat.date),
            datasets: [{
              data: stats.weeklyStats.map(stat => stat.count)
            }]
          }}
          width={screenWidth - 32}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.chartSection}>
        <Text style={[styles.chartTitle, { color: isDarkMode ? '#fff' : '#000' }]}>标签出现频率</Text>
        <PieChart
          data={stats.tagCategories.map((category, index) => {
            // 使用柔和的颜色数组
            const colors = isDarkMode ? [
              '#8B5CF6', // 柔和的紫色
              '#60A5FA', // 柔和的蓝色
              '#34D399', // 柔和的绿色
              '#F472B6', // 柔和的粉色
              '#FBBF24', // 柔和的黄色
            ] : [
              '#C4B5FD', // 淡紫色
              '#93C5FD', // 淡蓝色
              '#6EE7B7', // 淡绿色
              '#FBCFE8', // 淡粉色
              '#FDE68A', // 淡黄色
            ];
            return {
              name: `${category.category} (${category.count})`,
              count: category.count,
              color: colors[index % colors.length],
              legendFontColor: isDarkMode ? '#fff' : '#000',
            };
          })}
          width={screenWidth - 32}
          height={220}
          chartConfig={chartConfig}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    </View>
  );

  const renderMemeItem = ({ item }: { item: typeof stats.topMemes[0] }) => (
    <View style={[styles.memeItem, { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
      <Image source={{ uri: item.uri }} style={styles.memeImage} />
      <View style={styles.memeInfo}>
        <Text style={[styles.memeTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          表情 #{item.id.slice(0, 8)}
        </Text>
        <Text style={[styles.memeUseCount, { color: isDarkMode ? '#ccc' : '#666' }]}>
          使用次数: {item.useCount}
        </Text>
      </View>
    </View>
  );

  const renderPopularMemes = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>热门表情包</Text>
      <FlatList
        data={stats.topMemes}
        renderItem={renderMemeItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.memeList}
        scrollEnabled={false}
      />
    </View>
  );

  const renderTagAnalysis = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>标签使用频率</Text>
      <View style={styles.chartSection}>
        <BarChart
          data={{
            labels: stats.topTags.map(tag => tag.tag),
            datasets: [{
              data: stats.topTags.map(tag => tag.count),
              color: (opacity = 1) => isDarkMode ? 
                `rgba(96, 165, 250, ${opacity})` :  // 科技感浅蓝色
                `rgba(59, 130, 246, ${opacity})`,  // 更深的蓝色
            }]
          }}
          width={screenWidth - 32}
          height={280}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            ...chartConfig,
            barPercentage: 0.6,
            decimalPlaces: 0,
            formatXLabel: (label) => label.length > 3 ? label.slice(0, 2) + '..' : label,
            fillShadowGradient: isDarkMode ? 'transparent' : '#fff',
            fillShadowGradientOpacity: 1,
            propsForLabels: {
              translateY: -5,
            },
          }}
          style={{
            borderRadius: 16,
            paddingRight: 0,
            marginTop: 20,
            marginBottom: -40,
            marginLeft: 0,
            alignSelf: 'center',
          }}
          showValuesOnTopOfBars={true}
          fromZero={true}
          verticalLabelRotation={-45}
          withInnerLines={false}
        />
      </View>
      <View style={[styles.tagList, { marginTop: 32 }]}>
        {stats.topTags.map((tag, index) => (
          <View 
            key={tag.tag}
            style={[
              styles.tagItem,
              { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}
          >
            <Text style={[styles.tagRank, { color: isDarkMode ? '#fff' : '#000' }]}>
              #{index + 1}
            </Text>
            <Text style={[styles.tagName, { color: isDarkMode ? '#fff' : '#000' }]}>
              {tag.tag}
            </Text>
            <Text style={[styles.tagCount, { color: isDarkMode ? '#ccc' : '#666' }]}>
              {tag.count} 次
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderContent = () => {
    switch (route.params.type) {
      case 'overview':
        return renderOverview();
      case 'memes':
        return renderPopularMemes();
      case 'tags':
        return renderTagAnalysis();
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}
      contentContainerStyle={styles.content}
    >
      {renderContent()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
  },
  chartSection: {
    marginBottom: 24,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  memeItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  memeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  memeInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  memeTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  memeUseCount: {
    fontSize: 14,
  },
  memeList: {
    paddingTop: 8,
  },
  tagList: {
    marginTop: 16,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  tagRank: {
    fontSize: 16,
    fontWeight: '600',
    width: 40,
  },
  tagName: {
    flex: 1,
    fontSize: 16,
  },
  tagCount: {
    fontSize: 14,
    marginLeft: 8,
  },
}); 