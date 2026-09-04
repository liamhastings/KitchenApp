/**
 * Trimmed-down versions of the three page shapes that matter for import:
 * clean JSON-LD, a Recipe buried in a @graph, and a page with no recipe markup
 * at all. Kept as plain strings so `rules.check.ts` can run them under Node.
 */

/** The common case: one Recipe object, HowToStep instructions, entities. */
export const CLEAN_JSON_LD = `<!doctype html>
<html><head><title>Weeknight Chili</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Weeknight Chili &amp; Cornbread",
  "description": "A one-pot chili that&#39;s ready in an hour.",
  "recipeYield": "6 servings",
  "recipeIngredient": [
    "1 lb ground beef",
    "2 cups canned tomatoes",
    "1 large yellow onion, finely chopped",
    "2 cloves garlic, minced",
    "½ teaspoon cumin",
    "Salt and pepper to taste"
  ],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Brown the beef." },
    { "@type": "HowToStep", "text": "Add everything else and simmer." }
  ]
}
</script>
</head><body><h1>Weeknight Chili</h1></body></html>`;

/** WordPress-style: the Recipe sits inside @graph next to unrelated nodes. */
export const GRAPH_JSON_LD = `<!doctype html>
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Some Food Blog" },
    { "@type": ["Article", "BlogPosting"], "headline": "My grandmother's soup" },
    {
      "@type": "Recipe",
      "name": "Lemon Orzo Soup",
      "recipeYield": ["4", "4 servings"],
      "recipeIngredient": [
        "8 cups chicken broth",
        "1 cup orzo",
        "2 tablespoons olive oil",
        "Juice of 1 lemon"
      ],
      "recipeInstructions": [
        {
          "@type": "HowToSection",
          "itemListElement": [
            { "@type": "HowToStep", "text": "Bring the broth to a boil." },
            { "@type": "HowToStep", "text": "Add orzo and cook 8 minutes." }
          ]
        }
      ]
    }
  ]
}
</script>
</head><body></body></html>`;

/** A page with structured data, but nothing a kitchen can cook. */
export const NO_RECIPE = `<!doctype html>
<html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "NewsArticle", "headline": "Ten best pans" }
</script>
</head><body>
<h1>Ten best pans</h1>
<p>Our testers seared a lot of steak.</p>
</body></html>`;

/** Malformed JSON-LD ahead of a valid block — the good one must still win. */
export const BROKEN_THEN_VALID = `<!doctype html>
<html><head>
<script type="application/ld+json">{ "@type": "Recipe", oops }</script>
<script type="application/ld+json">
{ "@type": "Recipe", "name": "Toast", "recipeIngredient": ["2 slices bread"] }
</script>
</head><body></body></html>`;
