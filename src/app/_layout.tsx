import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toast } from '../components/Toast';
import { BookingsProvider } from '../state/BookingsContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BookingsProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="review" />
            <Stack.Screen name="matches" />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="requests" />
          </Stack>
          <Toast />
        </BookingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
