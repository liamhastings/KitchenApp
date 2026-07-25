import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { useAppStore } from './src/state/store';
import { AddRecipeScreen } from './src/ui/screens/AddRecipeScreen';
import { CheckoutScreen } from './src/ui/screens/CheckoutScreen';
import { GroceryScreen } from './src/ui/screens/GroceryScreen';
import { InventoryScreen } from './src/ui/screens/InventoryScreen';
import { RecipeDetailScreen } from './src/ui/screens/RecipeDetailScreen';
import { RecipesScreen } from './src/ui/screens/RecipesScreen';
import { colors } from './src/ui/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '900' },
  },
};

/** Emoji stand in for an icon set — one less dependency to carry in the MVP. */
function tabIcon(glyph: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}>
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{ tabBarIcon: tabIcon('🍳') }}
      />
      <Tab.Screen
        name="Grocery"
        component={GroceryScreen}
        options={{ title: 'Grocery List', tabBarIcon: tabIcon('🛒') }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ tabBarIcon: tabIcon('🥫') }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="RecipeDetail"
            component={RecipeDetailScreen}
            options={{ title: '' }}
          />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Review' }} />
          <Stack.Screen
            name="AddRecipe"
            component={AddRecipeScreen}
            options={{ title: 'New Recipe', presentation: 'modal' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
