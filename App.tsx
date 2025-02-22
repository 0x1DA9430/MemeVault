import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StatusBar } from 'expo-status-bar';
import { StorageService } from './src/services/storage';
import { SettingsService } from './src/services/settings';
import { TagService } from './src/services/tagService';
import { TagQueueService } from './src/services/tagQueue';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // 确保所有服务已初始化
    StorageService.getInstance();
    SettingsService.getInstance();
    TagService.getInstance();
    TagQueueService.getInstance();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'Meme Vault',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#000',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                style={{ padding: 8 }}
              >
                <Ionicons name="settings-outline" size={24} color="#000" />
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: '设置',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#000',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
