import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, AppStateStatus, ColorSchemeName } from 'react-native';
import { ThemeMode } from '../types/meme';
import { SettingsService } from '../services/settings';

interface ThemeContextType {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  themeMode: 'auto',
  setThemeMode: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const settingsService = SettingsService.getInstance();

  const checkSystemTheme = () => {
    const currentTheme = Appearance.getColorScheme();
    setSystemTheme(currentTheme);
  };

  useEffect(() => {
    loadThemeMode();
    checkSystemTheme();

    const themeSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadThemeMode();
        checkSystemTheme();
      }
    });

    return () => {
      themeSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const loadThemeMode = async () => {
    try {
      const settings = await settingsService.getSettings();
      setThemeModeState(settings.themeMode);
    } catch (error) {
      setThemeModeState('auto');
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      const settings = await settingsService.getSettings();
      await settingsService.saveSettings({ ...settings, themeMode: mode });
      setThemeModeState(mode);
    } catch (error) {
      throw error;
    }
  };

  const isDarkMode = 
    themeMode === 'dark' || 
    (themeMode === 'auto' && systemTheme === 'dark');

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        themeMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}; 