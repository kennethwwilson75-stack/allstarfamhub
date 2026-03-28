import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '@/lib/store';
import { checkAuth } from '@/lib/auth';
import { getToken } from '@/lib/api';
import { colors } from '@/lib/theme';

// Keep the splash screen visible while we fetch auth
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen may not be available in all environments
});

export default function RootLayout() {
  const isReady = useAppStore((s) => s.isReady);
  const setReady = useAppStore((s) => s.setReady);

  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await getToken();
        if (token) {
          await checkAuth();
        }
      } catch {
        // Auth check failed — user will be sent to login
      } finally {
        setReady();
        SplashScreen.hideAsync().catch(() => {
          // Ignore splash screen errors
        });
      }
    }
    bootstrap();
  }, [setReady]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
