import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UsageStatsScreen } from './src/screens/UsageStatsScreen';
import { StatusBar } from 'expo-status-bar';
import { StorageService } from './src/services/storage';
import { SettingsService } from './src/services/settings';
import { TagService } from './src/services/tagService';
import { TagQueueService } from './src/services/tagQueue';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  UsageStats: {
    type: 'memes' | 'tags' | 'overview';
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000',
    card: '#1c1c1c',
    text: '#fff',
    border: '#333',
  },
};

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#fff',
    card: '#fff',
    text: '#000',
    border: '#e0e0e0',
  },
};

function AppContent() {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    // 确保所有服务已初始化
    StorageService.getInstance();
    SettingsService.getInstance();
    TagService.getInstance();
    TagQueueService.getInstance();
  }, []);

  return (
    <NavigationContainer theme={isDarkMode ? customDarkTheme : customLightTheme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: isDarkMode ? '#1c1c1c' : '#fff',
          },
          headerTintColor: isDarkMode ? '#fff' : '#000',
          contentStyle: {
            backgroundColor: isDarkMode ? '#000' : '#fff',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'Meme Vault',
            headerTitleStyle: {
              fontWeight: 'bold',
              color: isDarkMode ? '#fff' : '#000',
            },
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                style={{ padding: 8 }}
              >
                <Ionicons 
                  name="settings-outline" 
                  size={24} 
                  color={isDarkMode ? '#fff' : '#000'} 
                />
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: '设置',
            headerTitleStyle: {
              fontWeight: 'bold',
              color: isDarkMode ? '#fff' : '#000',
            },
          }}
        />
        <Stack.Screen
          name="UsageStats"
          component={UsageStatsScreen}
          options={({ route }) => ({
            title: route.params?.type === 'memes' ? '热门表情包' :
                  route.params?.type === 'tags' ? '标签分析' : '使用统计',
            headerTitleStyle: {
              fontWeight: 'bold',
              color: isDarkMode ? '#fff' : '#000',
            },
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
