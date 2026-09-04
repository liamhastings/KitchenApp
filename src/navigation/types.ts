import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { IngredientLine } from '../logic/matching';

export type TabParamList = {
  Recipes: undefined;
  Grocery: undefined;
  Inventory: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  RecipeDetail: { recipeId: string };
  /** `lines` carries the user's have/need taps forward to the confirm step. */
  Checkout: { recipeId: string; lines: IngredientLine[] };
  AddRecipe: undefined;
  /** `url` opens the browser straight at a page, e.g. a recipe's source. */
  Browser: { url?: string } | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
