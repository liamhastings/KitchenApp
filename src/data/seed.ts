import { getMeta, setMeta } from './db';
import { createRecipe, type NewRecipeInput } from './recipeRepo';
import type { StoreSection } from './types';

const SEED_KEY = 'seeded_recipes_v1';

type SeedIngredient = [name: string, quantity: string, section: StoreSection];

interface SeedRecipe {
  title: string;
  description: string;
  servings: string;
  ingredients: SeedIngredient[];
}

/**
 * Starter recipes so the core loop is usable on first launch. Sections are set
 * here because it's the cheapest place to get sensible grocery-list grouping
 * without asking the user to categorize anything.
 */
const SEED_RECIPES: SeedRecipe[] = [
  {
    title: 'Weeknight Pasta Pomodoro',
    description: 'Blistered tomatoes, garlic, and basil tossed with spaghetti.',
    servings: '4',
    ingredients: [
      ['Spaghetti', '1 lb', 'pantry'],
      ['Cherry tomatoes', '2 pints', 'produce'],
      ['Garlic', '4 cloves', 'produce'],
      ['Basil', '1 bunch', 'produce'],
      ['Olive oil', '3 tbsp', 'pantry'],
      ['Parmesan', '1/2 cup', 'dairy'],
      ['Salt', 'to taste', 'spices'],
    ],
  },
  {
    title: 'Sheet Pan Chicken & Veg',
    description: 'One pan, 40 minutes, almost no cleanup.',
    servings: '4',
    ingredients: [
      ['Chicken thighs', '2 lb', 'meat_seafood'],
      ['Broccoli', '1 head', 'produce'],
      ['Red onion', '1', 'produce'],
      ['Potatoes', '1.5 lb', 'produce'],
      ['Olive oil', '3 tbsp', 'pantry'],
      ['Paprika', '2 tsp', 'spices'],
      ['Garlic', '3 cloves', 'produce'],
    ],
  },
  {
    title: 'Black Bean Tacos',
    description: 'Smoky black beans with quick-pickled onion.',
    servings: '3',
    ingredients: [
      ['Black beans', '2 cans', 'pantry'],
      ['Corn tortillas', '12', 'bakery'],
      ['Red onion', '1', 'produce'],
      ['Lime', '2', 'produce'],
      ['Cumin', '1 tsp', 'spices'],
      ['Cheddar', '1 cup', 'dairy'],
      ['Cilantro', '1 bunch', 'produce'],
      ['Sour cream', '1/2 cup', 'dairy'],
    ],
  },
  {
    title: 'Morning Oatmeal Bowl',
    description: 'Steel-cut oats with banana, peanut butter, and cinnamon.',
    servings: '2',
    ingredients: [
      ['Oats', '1 cup', 'pantry'],
      ['Banana', '2', 'produce'],
      ['Peanut butter', '2 tbsp', 'pantry'],
      ['Cinnamon', '1 tsp', 'spices'],
      ['Milk', '2 cups', 'dairy'],
      ['Honey', '1 tbsp', 'pantry'],
    ],
  },
  {
    title: 'Simple Egg Fried Rice',
    description: 'Best with day-old rice straight from the fridge.',
    servings: '3',
    ingredients: [
      ['Rice', '3 cups cooked', 'pantry'],
      ['Eggs', '3', 'dairy'],
      ['Frozen peas', '1 cup', 'frozen'],
      ['Carrots', '2', 'produce'],
      ['Soy sauce', '3 tbsp', 'pantry'],
      ['Scallions', '3', 'produce'],
      ['Sesame oil', '1 tsp', 'pantry'],
    ],
  },
  {
    title: 'Tomato Basil Grilled Cheese',
    description: 'Sourdough, sharp cheddar, and a slab of ripe tomato.',
    servings: '2',
    ingredients: [
      ['Sourdough bread', '4 slices', 'bakery'],
      ['Cheddar', '4 oz', 'dairy'],
      ['Tomato', '1', 'produce'],
      ['Basil', '6 leaves', 'produce'],
      ['Butter', '2 tbsp', 'dairy'],
    ],
  },
  {
    title: 'Lentil Soup',
    description: 'Hearty, freezes well, better the next day.',
    servings: '6',
    ingredients: [
      ['Lentils', '2 cups', 'pantry'],
      ['Carrots', '3', 'produce'],
      ['Celery', '3 stalks', 'produce'],
      ['Yellow onion', '1', 'produce'],
      ['Vegetable broth', '8 cups', 'pantry'],
      ['Garlic', '3 cloves', 'produce'],
      ['Cumin', '1 tsp', 'spices'],
      ['Olive oil', '2 tbsp', 'pantry'],
    ],
  },
  {
    title: 'Greek Yogurt Parfait',
    description: 'Five minutes, no cooking, works as breakfast or dessert.',
    servings: '2',
    ingredients: [
      ['Greek yogurt', '2 cups', 'dairy'],
      ['Frozen berries', '1 cup', 'frozen'],
      ['Granola', '1/2 cup', 'pantry'],
      ['Honey', '2 tbsp', 'pantry'],
    ],
  },
];

/**
 * Inserts the starter recipes exactly once, tracked by a flag in `meta`.
 * Seeded recipes are marked `is_user_created = 0` so the UI can tell them apart
 * from the user's own.
 */
export function seedIfNeeded(): void {
  if (getMeta(SEED_KEY)) return;

  for (const recipe of SEED_RECIPES) {
    const input: NewRecipeInput = {
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      isUserCreated: false,
      ingredients: recipe.ingredients.map(([name, quantity, section]) => ({
        name,
        quantity,
        section,
      })),
    };
    createRecipe(input);
  }

  setMeta(SEED_KEY, new Date().toISOString());
}
