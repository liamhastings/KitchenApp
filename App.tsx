import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { useAppStore } from './src/state/store';
import { AddRecipeScreen } from './src/ui/screens/AddRecipeScreen';
import { CheckoutScreen } from './src/ui/screens/CheckoutScreen';
import { GroceryScreen } from './src/ui/screens/GroceryScreen';
import { InventoryScreen } from './src/ui/screens/InventoryScreen';
import { RecipeDetailScreen } from './src/ui/screens/RecipeDetailScreen';
import { RecipesScreen } from './src/ui/screens/RecipesScreen';
import { colors, fonts, hairline, radius, spacing } from './src/ui/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.border,
    notification: colors.clay,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '400' },
    bold: { fontFamily: fonts.semibold, fontWeight: '400' },
    heavy: { fontFamily: fonts.semibold, fontWeight: '400' },
  },
};

/**
 * A filled dot rather than an icon. The tabs are three words; anything more
 * pictorial would be louder than the type it sits under.
 */
function TabDot({ focused }: { focused: boolean }) {
  return (
    <View
      style={[styles.tabDot, { backgroundColor: focused ? colors.accent : 'transparent' }]}
    />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: TabDot,
        tabBarIconStyle: styles.tabIcon,
      }}>
      <Tab.Screen name="Recipes" component={RecipesScreen} />
      <Tab.Screen name="Grocery" component={GroceryScreen} />
      {/* Route name stays `Inventory` — that's the domain term the schema,
          types and repos all use. Only the label is user-facing. */}
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Your Kitchen' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    init();
  }, [init]);

  // Held until both are true — a frame rendered in the fallback system font
  // before the real faces land reads as a layout glitch.
  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerBackTitle: 'Back',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.ink,
            headerTitleStyle: styles.headerTitle,
            contentStyle: { backgroundColor: colors.bg },
          }}>
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
  headerTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: hairline,
    borderTopColor: colors.border,
    elevation: 0,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  tabIcon: { flex: 0, height: 6, marginBottom: spacing.xs },
  tabDot: { width: 5, height: 5, borderRadius: radius.pill },
});
