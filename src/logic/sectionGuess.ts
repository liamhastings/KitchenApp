import type { StoreSection } from '../data/types';

/**
 * Guesses the aisle for a food the catalog has never heard of, so creating a
 * long-tail item ("pumpkin puree", "sesame seeds") is one tap instead of a
 * dropdown decision. Always a suggestion — the caller shows the picker anyway.
 *
 * Rules are tried in order and the first hit wins, so the specific cases at the
 * top are what keep "baking powder" out of the spice rack and "peanut butter"
 * out of the dairy case. Falls back to `other`, which is the honest answer when
 * nothing matches.
 */
const RULES: Array<[RegExp, StoreSection]> = [
  // Anything explicitly frozen, before its food words can match elsewhere.
  [/\bfrozen\b|\bice cream\b|\bpopsicle/, 'frozen'],

  // Specific overrides — these contain words that later rules would misread.
  [/\bbaking (powder|soda)\b|\bcocoa powder\b|\bprotein powder\b/, 'pantry'],
  [/\b(peanut|almond|cashew|sunflower|nut) butter\b/, 'pantry'],
  [/\b(coconut|evaporated|condensed|powdered) milk\b/, 'pantry'],
  [/\b(broth|stock|bouillon)\b|\bcanned\b|\bcan of\b/, 'pantry'],
  [/\b(chips|crackers|pretzels)\b/, 'pantry'],
  [/\bblack pepper\b|\bpeppercorn|\bpepper flakes\b|\blemon pepper\b/, 'spices'],

  [
    /\b(powder|seasoning|spice|extract|paprika|cumin|oregano|cinnamon|nutmeg|turmeric|cayenne|allspice|coriander|cardamom|masala|salt)\b/,
    'spices',
  ],
  [
    /\b(milk|cheese|yogurt|butter|cream|creamer|egg|eggs|kefir|ghee|tofu|tempeh|hummus)\b/,
    'dairy',
  ],
  [
    /\b(chicken|beef|pork|turkey|lamb|veal|bacon|sausage|steak|ribs|brisket|roast|salmon|shrimp|cod|tilapia|halibut|trout|crab|lobster|scallops|mussels|clams|ham|prosciutto|salami|pepperoni|chorizo)\b/,
    'meat_seafood',
  ],
  [
    /\b(bread|buns|bun|bagel|tortilla|baguette|rolls|muffin|croissant|pita|naan|ciabatta|focaccia|dough|pastry|sourdough|loaf|brioche|challah|scone|biscuits)\b/,
    'bakery',
  ],
  [/\b(juice|soda|tea|coffee|water|seltzer|kombucha|lemonade|cola|cider)\b/, 'beverages'],
  [
    /\b(lettuce|spinach|arugula|kale|greens|salad|herb|cilantro|parsley|basil|mint|thyme|rosemary|apple|apples|banana|berry|berries|melon|grape|grapes|peach|pear|plum|mango|citrus|lemon|lime|orange|onion|shallot|garlic|ginger|potato|potatoes|tomato|tomatoes|carrot|celery|cucumber|pepper|mushroom|broccoli|cauliflower|zucchini|squash|cabbage|avocado|corn|fresh)\b/,
    'produce',
  ],
  [
    /\b(flour|sugar|syrup|honey|molasses|oil|vinegar|sauce|paste|puree|beans|lentils|rice|pasta|noodles|spaghetti|oats|cereal|granola|jam|jelly|seeds|nuts|almonds|walnuts|pecans|cashews|pistachios|raisins|olives|tahini|starch|yeast|cocoa|chocolate|mix|marinade|dressing|salsa|soup|tuna|sardines|anchovies)\b/,
    'pantry',
  ],

  // Non-food kitchen staples.
  [/\b(foil|wrap|towels|napkins|bags|soap|detergent|sponges|plates|filters)\b/, 'other'],
];

export function guessSection(name: string): StoreSection {
  const text = name.trim().toLowerCase();
  if (!text) return 'other';

  for (const [pattern, section] of RULES) {
    if (pattern.test(text)) return section;
  }
  return 'other';
}
